import { withSessionRoute } from "../../src/session";
import { fetchTeams, fetchTimeEntries, TimeEntry } from "../../src/clickup";
import { sortBy } from "lodash-es";
import { prisma } from "../../src/db";
import { Timeplan } from "@prisma/client";

export interface TimingResponse {
  days: string[];
  lists: List[];
  users: User[];
  tags: Tag[];
  timePlans: JsonTimePlan[];
}

export interface List {
  id: number;
  space: string;
  name: string;
  entries: Record<string, Timing>;
}

export interface User {
  id: number;
  name: string;
  entries: Record<string, Timing>;
}

export interface Tag {
  name: string;
  entries: Record<string, Timing>;
}

export interface Timing {
  hours: number;
  references: Record<string, number>;
}

export interface JsonTimePlan {
  id: number;
  name: string;
  team_id: string;
  target_type: Timeplan["target_type"];
  target_id: string;
  cycle_start: string;
  cycle_days: number;
  cycle_end: string;
  hours: number;
}

/**
 * Since timeplans can be in the past, we need to fetch further back than we show
 */
const OVERFETCH_DAYS = 30;

export default withSessionRoute(async (req, res) => {
  if (!req.session.user) {
    res.status(400);
    res.json({ error: "Unauthorized" });
    return;
  }

  // preconnect to database for extra performance
  console.log("Ensure db connection");
  prisma.$connect().catch(console.error);

  // result collections
  const projects = new Map<number, List>();
  const users = new Map<number, User>();
  const tags = new Map<string, Tag>();
  const days: string[] = [];

  // create day list
  const endTime = Date.now();
  const startTime = endTime - 60 * 60 * 24 * 30 * 1000 - 1000;
  const overFetchStartTime = startTime - OVERFETCH_DAYS * 24 * 60 * 60 * 1000;
  for (
    let position = startTime;
    position <= endTime;
    position += 60 * 60 * 24 * 1000
  ) {
    days.push(timestampToDay(position));
  }

  // collect time tracking
  const { teams } = await fetchTeams({ token: req.session.user.access_token });
  const entryRequests = teams.map(async (team) => {
    await Promise.all(
      // split the time range into 2 requests to avoid hitting the rate limit
      [
        [overFetchStartTime, startTime - 1],
        [startTime, endTime],
      ].map(async ([start_date, end_date]) => {
        const startT = Date.now();
        console.log(
          "start fetching range",
          new Date(start_date),
          new Date(end_date)
        );
        const timeEntries = await fetchTimeEntries({
          teamId: team.id,
          token: req.session.user.access_token,
          start_date: start_date,
          end_date: end_date,
          assignee: team.members.map((member) => member.user.id).join(","),
          include_location_names: true,
          include_task_tags: true,
        });
        console.log(
          "done fetching range",
          new Date(start_date),
          new Date(end_date),
          timeEntries.length,
          `${Date.now() - startT}ms`
        );

        handleProjects(projects, timeEntries);
        handleUsers(users, timeEntries);
        handleTags(tags, timeEntries);
      })
    );
  });

  const timeplanT = Date.now();
  console.log("start fetching timeplans");
  const timePlans = await prisma.timeplan.findMany({
    where: {
      cycle_end: { gte: new Date(startTime) },
      cycle_start: { lte: new Date(endTime) },
      team_id: { in: teams.map((team) => team.id) },
    },
  });
  console.log(
    "done fetching timeplans",
    timePlans.length,
    `${Date.now() - timeplanT}ms`
  );

  await Promise.all(entryRequests);

  const result: TimingResponse = {
    days: days,
    lists: sortBy(Array.from(projects.values()), "list"),
    users: sortBy(Array.from(users.values()), "name"),
    tags: sortBy(Array.from(tags.values()), "name"),
    timePlans: timePlans as unknown as JsonTimePlan[],
  };

  res.json(result);
});

function handleProjects(lists: Map<number, List>, timeEntries: TimeEntry[]) {
  for (const timeEntry of timeEntries) {
    let list = lists.get(timeEntry.task_location.list_id);
    if (!list) {
      list = {
        id: timeEntry.task_location.list_id,
        space: timeEntry.task_location.space_name,
        name: timeEntry.task_location.list_name,
        entries: {},
      };

      lists.set(timeEntry.task_location.list_id, list);
    }

    handleTimings(list, timeEntry, timeEntry.user.username);
  }
}

function handleUsers(users: Map<number, User>, timeEntries: TimeEntry[]) {
  for (const timeEntry of timeEntries) {
    let user = users.get(timeEntry.user.id);
    if (!user) {
      user = {
        id: timeEntry.user.id,
        name: timeEntry.user.username,
        entries: {},
      };

      users.set(timeEntry.user.id, user);
    }

    const referenceName = [
      timeEntry.task_location.space_name,
      timeEntry.task_location.list_name,
    ];
    handleTimings(user, timeEntry, referenceName.join(" > "));
  }
}

function handleTags(tags: Map<string, Tag>, timeEntries: TimeEntry[]) {
  for (const timeEntry of timeEntries) {
    for (const tagEntry of [...timeEntry.tags, ...timeEntry.task_tags]) {
      let tag = tags.get(tagEntry.name);
      if (!tag) {
        tag = {
          name: tagEntry.name,
          entries: {},
        };

        tags.set(tagEntry.name, tag);
      }

      const referenceName = [
        timeEntry.task_location.space_name,
        timeEntry.task_location.list_name,
        timeEntry.user.username,
      ];
      handleTimings(tag, timeEntry, referenceName.join(" > "));
    }
  }
}

function handleTimings(
  subject: { entries: Record<string, Timing> },
  timeEntry: TimeEntry,
  referenceName: string
) {
  const day = timestampToDay(parseFloat(timeEntry.end));
  const booked = parseFloat(timeEntry.duration) / (60 * 60 * 1000);

  if (subject.entries[day]) {
    subject.entries[day].hours += booked;
  } else {
    subject.entries[day] = { hours: booked, references: {} };
  }

  if (subject.entries[day].references[referenceName]) {
    subject.entries[day].references[referenceName] += booked;
  } else {
    subject.entries[day].references[referenceName] = booked;
  }
}

function timestampToDay(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}
