import { withSessionRoute } from "../../src/session";
import { fetchTeams, fetchTimeEntries, TimeEntry } from "../../src/clickup";
import { sortBy } from "lodash-es";

export interface TimingResponse {
  days: string[];
  projects: Project[];
  users: User[];
  tags: Tag[];
}

export interface Project {
  id: number;
  space: string;
  list: string;
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
  booked: number;
  references: Record<string, number>;
}

const handler = withSessionRoute(async (req, res) => {
  if (!req.session.user) {
    res.status(400);
    res.json({ error: "Unauthorized" });
    return;
  }

  // result collections
  const projects = new Map<number, Project>();
  const users = new Map<number, User>();
  const tags = new Map<string, Tag>();
  const days: string[] = [];

  // create day list
  const endTime = Date.now();
  const startTime = endTime - 60 * 60 * 24 * 30 * 1000 - 1000;
  for (
    let position = startTime;
    position <= endTime;
    position += 60 * 60 * 24 * 1000
  ) {
    days.push(timestampToDay(position));
  }

  // collect time tracking
  const { teams } = await fetchTeams({ token: req.session.user.access_token });
  await Promise.all(
    teams.map(async (team) => {
      const timeEntries = await fetchTimeEntries({
        teamId: team.id,
        token: req.session.user.access_token,
        start_date: startTime,
        end_date: endTime,
        assignee: team.members.map((member) => member.user.id).join(","),
        include_location_names: true,
        include_task_tags: true,
      });

      handleProjects(projects, timeEntries);
      handleUsers(users, timeEntries);
      handleTags(tags, timeEntries);
    })
  );

  const result: TimingResponse = {
    days: days,
    projects: sortBy(Array.from(projects.values()), "list"),
    users: sortBy(Array.from(users.values()), "name"),
    tags: sortBy(Array.from(tags.values()), "name"),
  };

  res.json(result);
});

export default handler;

function handleProjects(
  projects: Map<number, Project>,
  timeEntries: TimeEntry[]
) {
  for (const timeEntry of timeEntries) {
    let project = projects.get(timeEntry.task_location.list_id);
    if (!project) {
      project = {
        id: timeEntry.task_location.list_id,
        space: timeEntry.task_location.space_name,
        list: timeEntry.task_location.list_name,
        entries: {},
      };

      projects.set(timeEntry.task_location.list_id, project);
    }

    handleTimings(project, timeEntry, timeEntry.user.username);
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
    subject.entries[day].booked += booked;
  } else {
    subject.entries[day] = { booked, references: {} };
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
