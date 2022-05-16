import Head from "next/head";
import useSWR from "swr";
import { JsonTimePlan, Timing, TimingResponse } from "./api/timing";
import classNames from "classnames";
import { Button } from "../components/button";
import { clamp, groupBy, sortBy } from "lodash-es";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Timeplan } from "@prisma/client";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const dateFormat = new Intl.DateTimeFormat("default", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

const DAY_WIDTH = 2.5;
const LABEL_WIDTH = 16;

export default function Table() {
  const [editTimePlan, setEditTimePlan] = useState<JsonTimePlan>();
  const { data, mutate } = useSWR<TimingResponse>("/api/timing", fetcher, {
    revalidateOnFocus: editTimePlan === undefined,
  });

  const save = useCallback(
    async (timePlan: JsonTimePlan) => {
      const response = await fetch("/api/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(timePlan),
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      await mutate();
      setEditTimePlan(undefined);
      return data.success;
    },
    [mutate]
  );

  // merge the edited time plan into the list
  const timePlans = useMemo(() => {
    if (!data) {
      return [];
    }

    if (!editTimePlan) {
      return data.timePlans;
    }

    const timePlans = [...data.timePlans];
    if (editTimePlan) {
      const existingIndex = timePlans.findIndex(
        (t) => t.id === editTimePlan.id
      );
      if (existingIndex >= 0) {
        timePlans[existingIndex] = editTimePlan;
      } else {
        timePlans.push(editTimePlan);
      }
    }

    return timePlans;
  }, [data, editTimePlan]);

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
              team_id={user.team_id}
              days={data.days}
              entries={user.entries}
              timePlans={timePlans}
              editTimePlan={editTimePlan}
              setEditTimePlan={setEditTimePlan}
              save={save}
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
              team_id={tag.team_id}
              days={data.days}
              entries={tag.entries}
              timePlans={timePlans}
              editTimePlan={editTimePlan}
              setEditTimePlan={setEditTimePlan}
              save={save}
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
                team_id={list.team_id}
                days={data.days}
                entries={list.entries}
                timePlans={timePlans}
                editTimePlan={editTimePlan}
                setEditTimePlan={setEditTimePlan}
                save={save}
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
  team_id,
  days,
  entries,
  timePlans,
  editTimePlan,
  setEditTimePlan,
  save,
  cellClassName,
}: {
  id: string;
  type: Timeplan["target_type"];
  name: string;
  team_id: string;
  days: string[];
  entries: Record<string, Timing>;
  timePlans: JsonTimePlan[];
  editTimePlan?: JsonTimePlan;
  setEditTimePlan: (timePlan: JsonTimePlan | undefined) => void;
  save: (timePlan: JsonTimePlan) => Promise<void>;
  cellClassName?: (timing: Timing) => string;
}) {
  const timePlanMap = useMemo<Record<string, ExtendedTimePlan>>(() => {
    const timePlanMap = {} as Record<string, ExtendedTimePlan>;
    for (const timePlan of timePlans) {
      if (timePlan.target_type !== type || timePlan.target_id !== id) {
        continue;
      }

      const endCycleTimestamp = Math.min(
        new Date(timePlan.cycle_end).getTime(),
        new Date(days[days.length - 1]).getTime()
      );
      for (
        let cycleStart = new Date(timePlan.cycle_start);
        cycleStart.getTime() <= endCycleTimestamp;
        cycleStart.setUTCDate(cycleStart.getUTCDate() + timePlan.cycle_days)
      ) {
        const endDate = new Date(cycleStart);
        endDate.setUTCDate(cycleStart.getUTCDate() + timePlan.cycle_days);
        if (endDate.getTime() > endCycleTimestamp) {
          endDate.setTime(endCycleTimestamp);
        }

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

    return timePlanMap;
  }, [days, entries, id, timePlans, type]);

  const edit =
    editTimePlan &&
    Object.values(timePlanMap).some(
      (timePlan) => timePlan.timePlan === editTimePlan
    );

  return (
    <tr className="hover:bg-slate-100 align-top">
      <th className="sticky left-0 z-20 bg-white border-r whitespace-nowrap text-right font-normal">
        <div className="truncate" title={`id: ${id}`}>
          {name}
        </div>
        {edit && (
          <EditModal
            editTimePlan={editTimePlan}
            setEditTimePlan={setEditTimePlan}
            save={save}
          />
        )}
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
          <Button
            className="group block w-full hover:bg-slate-200"
            onClick={() =>
              setEditTimePlan({
                id: 0,
                team_id: team_id,
                name: "",
                cycle_start: new Date(day).toISOString().substring(0, 10),
                cycle_end: dateAdd(day, 6).toISOString().substring(0, 10),
                cycle_days: 7,
                target_id: id,
                target_type: type,
                hours: 8,
              })
            }
          >
            {formatNumber(entries[day]?.hours) || " "}
            {entries[day] && (
              <ReferenceModal references={entries[day].references} />
            )}
          </Button>
          {timePlanMap[day] && (
            <TimePlanBlock
              {...timePlanMap[day]}
              editing={timePlanMap[day].timePlan === editTimePlan}
              onClick={() => setEditTimePlan(timePlanMap[day].timePlan)}
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

const GLOBAL_RELEVANT_PROPS = [
  "cycle_start",
  "cycle_end",
  "cycle_days",
  "hours",
];

function EditModal({
  editTimePlan,
  setEditTimePlan,
  save,
}: {
  editTimePlan: JsonTimePlan;
  setEditTimePlan: (timePlan: JsonTimePlan | undefined) => void;
  save: (timePlan: JsonTimePlan) => Promise<void>;
}) {
  const { register, handleSubmit, watch, setValue, reset } = useForm({
    defaultValues: editTimePlan,
  });

  useEffect(() => {
    reset(editTimePlan);
  }, [editTimePlan, reset]);

  useEffect(() => {
    const sub = watch((value, { name }) => {
      if (!name || GLOBAL_RELEVANT_PROPS.includes(name)) {
        setEditTimePlan(value as JsonTimePlan);
      }
      if (value.cycle_end && value.cycle_start && value.cycle_days) {
        const endDate = dateAdd(value.cycle_start, value.cycle_days - 1)
          .toISOString()
          .slice(0, 10);
        if (value.cycle_end < endDate) {
          setValue("cycle_end", endDate);
        }
      }
    });
    return () => sub.unsubscribe();
  }, [setEditTimePlan, setValue, watch]);

  return (
    <form className="absolute left-full top-full bg-white mx-2 px-4 py-2 rounded border shadow-lg">
      <div className="flex flex-col">
        <label className="flex flex-row items-center gap-2 justify-between">
          Start
          <input
            type="date"
            className="w-32"
            max={dateAdd(watch("cycle_end"), watch("cycle_days") * -1 + 1)
              .toISOString()
              .slice(0, 10)}
            {...register("cycle_start", {
              required: true,
            })}
          />
        </label>
        <label className="flex flex-row items-center gap-2 justify-between">
          End
          <input
            type="date"
            className="w-32"
            min={dateAdd(watch("cycle_start"), watch("cycle_days") - 1)
              .toISOString()
              .slice(0, 10)}
            {...register("cycle_end", {
              required: true,
            })}
          />
        </label>
        <label className="flex flex-row items-center gap-2 justify-between">
          Days
          <input
            type="number"
            className="w-32"
            {...register("cycle_days", {
              min: 1,
              max: 31,
              valueAsNumber: true,
              required: true,
            })}
          />
        </label>
        <label className="flex flex-row items-center gap-2 justify-between">
          Hours
          <input
            type="number"
            className="w-32"
            {...register("hours", {
              min: 1,
              max: 10000,
              valueAsNumber: true,
              required: true,
            })}
          />
        </label>
        <label className="flex flex-row items-center gap-2 justify-between">
          Name
          <input type="text" className="w-32" {...register("name")} />
        </label>
      </div>
      <div className="flex flex-row" role="toolbar">
        <Button
          onClick={handleSubmit(save)}
          className="flex-grow px-4 py-2 text-white bg-blue-500 hover:bg-blue-400"
        >
          Save
        </Button>
        {editTimePlan.id > 0 && (
          <Button
            onClick={() => save({ ...editTimePlan, hours: 0 })}
            className="flex-grow px-4 py-2 text-white bg-red-500 hover:bg-red-400"
          >
            Delete
          </Button>
        )}
        <Button
          onClick={() => setEditTimePlan(undefined)}
          className="flex-grow px-4 py-2 text-white bg-slate-500 hover:bg-slate-400"
        >
          Close
        </Button>
      </div>
    </form>
  );
}

function TimePlanBlock({
  timePlan,
  usedHours,
  dayWidth,
  startDay,
  endDay,
  editing,
  onClick,
}: ExtendedTimePlan & {
  dayWidth: number;
  editing?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={classNames(
        "relative z-10 bg-blue-400/25 text-black text-xs text-center rounded-b-xl px-2 py-1 overflow-hidden",
        { "animate-bounce": editing }
      )}
      onClick={onClick}
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
          `${dateFormat.format(new Date(startDay))} - ` +
          `${dateFormat.format(new Date(endDay))}`
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

function dateAdd(str: string, days: number) {
  const date = new Date(str);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
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
