import { withSessionRoute } from "../../src/session";
import { fetchTeams, fetchTimeEntries } from "../../src/clickup";

export interface TimingResponse {
  days: string[];
  projects: Project[];
  users: ProjectUser[];
}

export interface Project {
  id: number;
  space: string;
  list: string;
  entries: Record<string, Timing>;
}

export interface Timing {
  day: string;
  booked: number;
  bookings: number;
  users: Record<string, number>;
}

export interface ProjectUser {
  id: number;
  name: string;
  entries: Record<string, UserTiming>;
}

export interface UserTiming {
  booked: number;
  projects: Record<string, number>;
}

const handler = withSessionRoute(async (req, res) => {
  if (!req.session.user) {
    res.status(400);
    res.json({ error: "Unauthorized" });
    return;
  }

  // result collections
  const projects = new Map<number, Project>();
  const users = new Map<number, ProjectUser>();
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
      });

      for (const timeEntry of timeEntries) {
        // project time entries

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

        const day = timestampToDay(parseFloat(timeEntry.end));
        const booked = parseFloat(timeEntry.duration) / (60 * 60 * 1000);
        if (project.entries[day]) {
          project.entries[day].booked += booked;
          project.entries[day].bookings += 1;
        } else {
          project.entries[day] = { day, booked, bookings: 1, users: {} };
        }

        if (project.entries[day].users[timeEntry.user.username]) {
          project.entries[day].users[timeEntry.user.username] += booked;
        } else {
          project.entries[day].users[timeEntry.user.username] = booked;
        }

        // user time entries

        let user = users.get(timeEntry.user.id);
        if (!user) {
          user = {
            id: timeEntry.user.id,
            name: timeEntry.user.username,
            entries: {},
          };

          users.set(timeEntry.user.id, user);
        }

        if (user.entries[day]) {
          user.entries[day].booked += booked;
        } else {
          user.entries[day] = { booked, projects: {} };
        }

        const fullProjectName = `${project.space} > ${project.list}`;
        if (user.entries[day].projects[fullProjectName]) {
          user.entries[day].projects[fullProjectName] += booked;
        } else {
          user.entries[day].projects[fullProjectName] = booked;
        }
      }
    })
  );

  const result: TimingResponse = {
    days: days,
    projects: Array.from(projects.values()).sort((a, b) =>
      a.list.localeCompare(b.list)
    ),
    users: Array.from(users.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
  };

  res.json(result);
});

export default handler;

function timestampToDay(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}
