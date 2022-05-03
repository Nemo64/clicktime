import Head from "next/head";
import useSWR from "swr";
import { TimingResponse } from "./api/timing";
import classNames from "classnames";
import { Button } from "../components/button";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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
      <table>
        <thead className="sticky top-0 bg-white">
          <tr>
            <th className="font-normal">
              <Button
                href="/"
                className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white"
              >
                back
              </Button>
            </th>
            {data.days.map((day) => (
              <th key={day} className="whitespace-nowrap">
                {day.slice(5)}
              </th>
            ))}
          </tr>
        </thead>
        {spaces.map((space) => (
          <tbody key={space} className="hover:bg-slate-50">
            <tr>
              <th className="whitespace-nowrap text-right pt-6">{space}</th>
              <th colSpan={data.days.length} />
            </tr>
            {data.projects
              .filter((p) => p.space === space)
              .map((project) => (
                <tr key={project.id} className="hover:bg-slate-100">
                  <th className="whitespace-nowrap text-right font-normal">
                    {project.list}
                  </th>
                  {data.days.map((day) => {
                    const hours =
                      (project.entries[day]?.booked ?? 0) / (60 * 60 * 1000);
                    return (
                      <td
                        key={day}
                        className={classNames("text-right relative group", {
                          "text-slate-300": hours <= 0,
                        })}
                      >
                        {hours.toFixed(2)}
                        {project.entries[day] && (
                          <div className="select-none pointer-events-none absolute z-10 top-100 right-0 hidden group-hover:block bg-white px-4 py-2 shadow rounded">
                            {Object.entries(project.entries[day]?.users).map(
                              ([user, booked]) => {
                                const hours = booked / (60 * 60 * 1000);
                                return (
                                  <div
                                    key={user}
                                    className="text-xs text-right whitespace-nowrap"
                                  >
                                    {user}: {hours.toFixed(2)}
                                  </div>
                                );
                              }
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
