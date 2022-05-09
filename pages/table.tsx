import Head from "next/head";
import useSWR from "swr";
import { JsonTimePlan, Timing, TimingResponse } from "./api/timing";
import classNames from "classnames";
import { Button } from "../components/button";
import { clamp, groupBy, sortBy } from "lodash-es";
import { ReactNode } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const dateFormat = new Intl.DateTimeFormat("default", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

const DAY_WIDTH = 2.5;
const LABEL_WIDTH = 16;

export default function Table() {
  const { data } = useSWR<TimingResponse>("/api/timing", fetcher);

  if (!data) {
    return (
      <div>
        <Head>
          <title>Loading</title>
          <meta name="robots" content="noindex" />
        </Head>
        <Button
          href="/"
          className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white"
        >
          back
        </Button>
        <p>loading...</p>
      </div>
    );
  }

  return (
    <div>
      <Head>
        <title>Table</title>
        <meta name="robots" content="noindex" />
      </Head>

      <table
        className="table-fixed border-separate mb-8"
        style={{
          width: `${data.days.length * DAY_WIDTH + LABEL_WIDTH}rem`,
          borderSpacing: 0,
        }}
      >
        <thead>
          <tr className="sticky top-0 z-40 bg-white shadow">
            <th className="font-normal" style={{ width: `${LABEL_WIDTH}rem` }}>
              <Button
                href="/"
                className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white"
              >
                back
              </Button>
            </th>
            {data.days.map((day) => (
              <th
                key={day}
                className={classNames({
                  "text-center": true,
                  "bg-green-400/10": isWeekend(day),
                })}
              >
                {dateFormat.format(new Date(day))}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="hover:bg-slate-50">
          <TimingHeadline days={data.days}>Benutzer</TimingHeadline>
          {data.users.map((user) => (
            <TimingRow
              key={user.name}
              id={String(user.id)}
              type={"user"}
              name={user.name}
              days={data.days}
              entries={user.entries}
              timePlans={data.timePlans}
              cellClassName={(timing) =>
                classNames({
                  "text-red-800": timing?.hours < 6,
                  "text-blue-800": timing?.hours > 8,
                })
              }
            />
          ))}
        </tbody>

        <tbody className="hover:bg-slate-50">
          <TimingHeadline days={data.days}>Tags</TimingHeadline>
          {data.tags.map((tag) => (
            <TimingRow
              key={tag.name}
              id={tag.name}
              type={"tag"}
              name={`#${tag.name}`}
              days={data.days}
              entries={tag.entries}
              timePlans={data.timePlans}
            />
          ))}
        </tbody>

        {Object.entries(groupBy(data.lists, "space")).map(([space, lists]) => (
          <tbody key={space} className="hover:bg-slate-50">
            <TimingHeadline days={data.days}>{space}</TimingHeadline>
            {lists.map((list) => (
              <TimingRow
                key={list.name}
                id={String(list.id)}
                type={"list"}
                name={list.name}
                days={data.days}
                entries={list.entries}
                timePlans={data.timePlans}
              />
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function TimingHeadline({
  children,
  days,
}: {
  children: ReactNode;
  days: string[];
}) {
  return (
    <tr>
      <th className="sticky left-0 z-20 bg-white border-r whitespace-nowrap text-right pt-6">
        <div className="truncate">{children}</div>
      </th>
      <th colSpan={days.length} />
    </tr>
  );
}

interface ExtendedTimePlan {
  timePlan: JsonTimePlan;
  usedHours: number;
  startDay: string;
  endDay: string;
}

function TimingRow({
  id,
  type,
  name,
  days,
  entries,
  timePlans,
  cellClassName,
}: {
  id: string;
  type: string;
  name: string;
  days: string[];
  entries: Record<string, Timing>;
  timePlans: JsonTimePlan[];
  cellClassName?: (timing: Timing) => string;
}) {
  const timePlanMap = {} as Record<string, ExtendedTimePlan>;
  for (const timePlan of timePlans) {
    if (timePlan.target_type !== type || timePlan.target_id !== id) {
      continue;
    }

    const endCycleTimestamp = new Date(timePlan.cycle_end).getTime();
    for (
      let cycleStart = new Date(timePlan.cycle_start);
      cycleStart.getTime() <= endCycleTimestamp;
      cycleStart.setUTCDate(cycleStart.getUTCDate() + timePlan.cycle_days)
    ) {
      const endDate = new Date(
        new Date(cycleStart).setUTCDate(
          cycleStart.getUTCDate() + timePlan.cycle_days
        )
      );

      const startDay = cycleStart.toISOString().slice(0, 10);
      const endDay = endDate.toISOString().slice(0, 10);
      if (endDay < days[0] || startDay > days[days.length - 1]) {
        continue;
      }

      const key = days.includes(startDay) ? startDay : days[0];
      timePlanMap[key] = { timePlan, usedHours: 0, startDay, endDay };

      const endTimestamp = endDate.getTime();
      for (
        let i = new Date(cycleStart);
        i.getTime() <= endTimestamp;
        i.setUTCDate(i.getUTCDate() + 1)
      ) {
        timePlanMap[key].usedHours +=
          entries[i.toISOString().slice(0, 10)]?.hours ?? 0;
      }
    }
  }

  return (
    <tr className="hover:bg-slate-100 align-top">
      <th className="sticky left-0 z-20 bg-white border-r whitespace-nowrap text-right font-normal">
        <div className="truncate" title={`id: ${id}`}>
          {name}
        </div>
      </th>
      {days.map((day) => (
        <td
          key={day}
          className={classNames(
            "text-right relative",
            { "bg-green-400/10": isWeekend(day) },
            cellClassName?.(entries[day])
          )}
        >
          <div className="group hover:bg-slate-200">
            {formatNumber(entries[day]?.hours) || " "}
            {entries[day] && (
              <ReferenceModal references={entries[day].references} />
            )}
          </div>
          {timePlanMap[day] && (
            <TimePlanBlock
              {...timePlanMap[day]}
              dayWidth={Math.min(
                daysBetween(day, timePlanMap[day].startDay) +
                  timePlanMap[day].timePlan.cycle_days,
                daysBetween(day, days[days.length - 1]) + 1,
                daysBetween(day, timePlanMap[day].endDay) + 1
              )}
            />
          )}
        </td>
      ))}
    </tr>
  );
}

function TimePlanBlock({
  timePlan,
  usedHours,
  dayWidth,
  startDay,
  endDay,
}: ExtendedTimePlan & { dayWidth: number }) {
  return (
    <div
      className="relative z-10 bg-blue-400/25 text-black text-xs text-center rounded-b-xl px-2 py-1 overflow-hidden"
      style={{ width: `${DAY_WIDTH * dayWidth}rem` }}
    >
      <div
        className="bg-emerald-300 absolute top-0 left-0 h-full"
        style={{
          width: `${clamp(usedHours / timePlan.hours, 0, 1) * 100}%`,
        }}
      />
      <div
        className="bg-red-300 absolute top-0 left-0 h-full"
        style={{
          width: `${clamp(usedHours / timePlan.hours - 1, 0, 1) * 100}%`,
        }}
      />
      <div
        className="whitespace-nowrap relative"
        title={
          `${formatNumber(usedHours)} hours used of\n` +
          `${formatNumber(timePlan.hours)} planned hours\n` +
          `from ${dateFormat.format(new Date(startDay))} ` +
          `to ${dateFormat.format(new Date(endDay))}`
        }
      >
        {formatNumber(usedHours)} / {formatNumber(timePlan.hours)}
      </div>
    </div>
  );
}

function ReferenceModal({
  references,
}: {
  references: Record<string, number>;
}) {
  return (
    <div className="select-none pointer-events-none absolute z-50 top-full right-0 hidden group-hover:block bg-white text-black px-4 py-2 shadow border rounded">
      {sortBy(Object.entries(references), "0").map(([user, booked]) => (
        <div key={user} className="text-xs text-right whitespace-nowrap">
          {user}: {formatNumber(booked)}
        </div>
      ))}
    </div>
  );
}

function daysBetween(start: string, end: string) {
  return (
    (new Date(end).getTime() - new Date(start).getTime()) / 1000 / 60 / 60 / 24
  );
}

function isWeekend(date: string) {
  return [0, 6].includes(new Date(date).getDay());
}

function formatNumber(number?: number) {
  if (typeof number !== "number") {
    return "";
  }

  if (number >= 100) {
    return number.toFixed(0);
  }

  if (number >= 10) {
    return number.toFixed(1);
  }

  return number.toFixed(2);
}
