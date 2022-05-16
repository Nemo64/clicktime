import { withSessionRoute } from "../../src/session";
import { JsonTimePlan } from "./timing";
import { fetchTeams } from "../../src/clickup";
import { prisma } from "../../src/db";
import { Timeplan } from "@prisma/client";

export default withSessionRoute(async (req, res) => {
  const timing = req.body as JsonTimePlan;

  if (!timing) {
    res.status(400).json({ error: "No timing data provided" });
    return;
  }

  // preconnect
  prisma.$connect().catch(console.error);

  const { teams } = await fetchTeams({ token: req.session.user.access_token });
  if (!teams.find((team) => timing.team_id === team.id)) {
    res.status(403).json({ error: "Team not found" });
    return;
  }

  const record: Omit<Timeplan, "id"> = {
    team_id: timing.team_id,
    name: timing.name,
    target_type: timing.target_type,
    target_id: timing.target_id,
    cycle_start: new Date(timing.cycle_start),
    cycle_end: new Date(timing.cycle_end),
    cycle_days: timing.cycle_days,
    hours: timing.hours,
  };

  if (timing.hours <= 0) {
    if (timing.id) {
      await prisma.timeplan.delete({ where: { id: timing.id } });
      res.status(200).json({ success: true });
      return;
    } else {
      res.status(400).json({ error: "Hours must be greater than 0" });
      return;
    }
  }

  if (timing.id > 0) {
    const record = await prisma.timeplan.findFirst({
      where: { id: timing.id, team_id: timing.team_id },
    });

    if (!record || record.team_id !== timing.team_id) {
      res.status(403).json({ error: "Not found" });
      return;
    }

    await prisma.timeplan.update({ data: record, where: { id: timing.id } });
    res.status(200).json({ success: true });
  } else {
    await prisma.timeplan.create({ data: record });
    res.status(201).json({ success: true });
  }
});
