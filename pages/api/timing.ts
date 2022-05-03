import { withSessionRoute } from "../../src/session";
import { fetchTeams, fetchTimeEntries } from "../../src/clickup";

export interface TimingResponse {
  days: string[];
  projects: Project[];
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

const handler = withSessionRoute(async (req, res) => {
  if (!req.session.user) {
    res.status(400);
    res.json({ error: "Unauthorized" });
    return;
  }

  const projects = new Map<number, Project>();
  const endTime = Date.now();
  const startTime = endTime - 60 * 60 * 24 * 30 * 1000 - 1000;

  const days: string[] = [];
  for (
    let position = startTime;
    position <= endTime;
    position += 60 * 60 * 24 * 1000
  ) {
    days.push(timestampToDay(position));
  }

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
        const booked = parseFloat(timeEntry.duration);
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
      }
    })
  );

  const result: TimingResponse = {
    days: days,
    projects: Array.from(projects.values()),
  };

  res.json(result);
});

export default handler;

function timestampToDay(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}
