import Head from "next/head";
import useSWR from "swr";
import { TimingResponse } from "./api/timing";
import classNames from "classnames";
import { Button } from "../components/button";

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

  const spaces: string[] = data.projects
    .map((project) => project.space)
    .filter((value, index, self) => self.indexOf(value) === index)
    .sort();

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
            <tr key={user.id} className="hover:bg-slate-100">
              <th className="sticky left-0 z-10 bg-white border-r whitespace-nowrap text-right font-normal">
                {user.name}
              </th>
              {data.days.map((day) => (
                <td
                  key={day}
                  className={classNames({
                    "text-right relative group hover:bg-slate-200": true,
                    "bg-green-400/10": isWeekend(day),
                    "text-red-800": user.entries[day]?.booked < 6,
                    "text-blue-800": user.entries[day]?.booked > 8,
                  })}
                >
                  {formatNumber(user.entries[day]?.booked)}
                  {user.entries[day] && (
                    <div className="select-none pointer-events-none absolute z-10 top-100 right-0 hidden group-hover:block bg-white text-black px-4 py-2 shadow border rounded">
                      {Object.entries(user.entries[day]?.projects).map(
                        ([project, booked]) => (
                          <div
                            key={project}
                            className="text-xs text-right whitespace-nowrap"
                          >
                            {project}: {formatNumber(booked)}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>

        {spaces.map((space) => (
          <tbody key={space} className="hover:bg-slate-50">
            <tr>
              <th className="sticky left-0 z-10 bg-white border-r whitespace-nowrap text-right pt-6">
                {space}
              </th>
              <th colSpan={data.days.length} />
            </tr>
            {data.projects
              .filter((p) => p.space === space)
              .map((project) => (
                <tr key={project.id} className="hover:bg-slate-100">
                  <th className="sticky left-0 z-10 bg-white border-r whitespace-nowrap text-right font-normal">
                    {project.list}
                  </th>
                  {data.days.map((day) => (
                    <td
                      key={day}
                      className={classNames({
                        "text-right relative group hover:bg-slate-200": true,
                        "bg-green-400/10": isWeekend(day),
                      })}
                    >
                      {formatNumber(project.entries[day]?.booked)}
                      {project.entries[day] && (
                        <div className="select-none pointer-events-none absolute z-10 top-100 right-0 hidden group-hover:block bg-white text-black px-4 py-2 shadow border rounded">
                          {Object.entries(project.entries[day]?.users).map(
                            ([user, booked]) => (
                              <div
                                key={user}
                                className="text-xs text-right whitespace-nowrap"
                              >
                                {user}: {formatNumber(booked)}
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        ))}
      </table>
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
