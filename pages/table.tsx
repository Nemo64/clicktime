import Head from "next/head";
import useSWR from "swr";
import { Timing, TimingResponse } from "./api/timing";
import classNames from "classnames";
import { Button } from "../components/button";
import { groupBy, sortBy } from "lodash-es";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const dateFormat = new Intl.DateTimeFormat("default", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

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
        style={{ width: `${data.days.length * 2.5 + 16}rem`, borderSpacing: 0 }}
      >
        <thead>
          <tr className="sticky top-0 z-20 bg-white shadow">
            <th className="font-normal" style={{ width: "16rem" }}>
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
          <tr>
            <th className="sticky left-0 z-10 bg-white border-r whitespace-nowrap text-right pt-6">
              Benutzer
            </th>
            <th colSpan={data.days.length} />
          </tr>
          {data.users.map((user) => (
            <TimingRow
              key={user.name}
              name={user.name}
              days={data.days}
              entries={user.entries}
              cellClassName={(timing) =>
                classNames({
                  "text-red-800": timing?.booked < 6,
                  "text-blue-800": timing?.booked > 8,
                })
              }
            />
          ))}
        </tbody>

        <tbody className="hover:bg-slate-50">
          <tr>
            <th className="sticky left-0 z-10 bg-white border-r whitespace-nowrap text-right pt-6">
              Tags
            </th>
            <th colSpan={data.days.length} />
          </tr>
          {data.tags.map((tag) => (
            <TimingRow
              key={tag.name}
              name={`#${tag.name}`}
              days={data.days}
              entries={tag.entries}
            />
          ))}
        </tbody>

        {Object.entries(groupBy(data.projects, "space")).map(
          ([space, projects]) => (
            <tbody key={space} className="hover:bg-slate-50">
              <tr>
                <th className="sticky left-0 z-10 bg-white border-r whitespace-nowrap text-right pt-6">
                  {space}
                </th>
                <th colSpan={data.days.length} />
              </tr>
              {projects.map((project) => (
                <TimingRow
                  key={project.list}
                  name={project.list}
                  days={data.days}
                  entries={project.entries}
                />
              ))}
            </tbody>
          )
        )}
      </table>
    </div>
  );
}

function TimingRow({
  name,
  days,
  entries,
  cellClassName,
}: {
  name: string;
  days: string[];
  entries: Record<string, Timing>;
  cellClassName?: (timing: Timing) => string;
}) {
  return (
    <tr className="hover:bg-slate-100">
      <th className="sticky left-0 z-10 bg-white border-r whitespace-nowrap text-right font-normal">
        {name}
      </th>
      {days.map((day) => (
        <td
          key={day}
          className={classNames(
            "text-right relative group hover:bg-slate-200",
            { "bg-green-400/10": isWeekend(day) },
            cellClassName?.(entries[day])
          )}
        >
          {formatNumber(entries[day]?.booked)}
          {entries[day] && (
            <ReferenceModal references={entries[day].references} />
          )}
        </td>
      ))}
    </tr>
  );
}

function ReferenceModal({
  references,
}: {
  references: Record<string, number>;
}) {
  return (
    <div className="select-none pointer-events-none absolute z-50 top-100 right-0 hidden group-hover:block bg-white text-black px-4 py-2 shadow border rounded">
      {sortBy(Object.entries(references), "0").map(([user, booked]) => (
        <div key={user} className="text-xs text-right whitespace-nowrap">
          {user}: {formatNumber(booked)}
        </div>
      ))}
    </div>
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
