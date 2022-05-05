import axios from "axios";

export async function fetchTeams({ token }: { token: string }): Promise<Teams> {
  const response = await axios({
    url: "https://api.clickup.com/api/v2/team",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
  });

  return response.data;
}

export async function fetchTimeEntries({
  token,
  teamId,
  ...other
}: {
  token: string;
  teamId: string;
  start_date?: number;
  end_date?: number;
  assignee?: string;
  include_location_names?: boolean;
  include_task_tags?: boolean;
}): Promise<TimeEntry[]> {
  const response = await axios({
    url: `https://api.clickup.com/api/v2/team/${teamId}/time_entries`,
    params: other,
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
  });

  return response.data.data;
}

export interface Teams {
  teams: Team[];
}

export interface Team {
  id: string;
  name: string;
  color: string;
  avatar: string;
  members: { user: User }[];
}

export interface User {
  id: number;
  username: string;
  color: string;
  profilePicture: string;
}

export interface TimeEntry {
  id: string;
  task: {
    id: string;
    custom_id: string;
    name: string;
    status: {
      status: string;
      color: string;
      type: string;
      orderindex: number;
    };
    custom_type: unknown;
  };
  wid: string;
  user: {
    id: number;
    username: string;
    email: string;
    color: string;
    initials: string;
    profilePicture: string;
  };
  billable: boolean;
  start: string;
  end: string;
  duration: string;
  description: string;
  tags: Tag[];
  source: string;
  at: string;
  task_location: {
    list_id: number;
    folder_id: number;
    space_id: number;
    list_name: string;
    folder_name: string;
    space_name: string;
  };
  task_tags: Tag[];
  task_url: string;
}

export interface Tag {
  name: string;
  tag_fg: string;
  tag_bg: string;
  creator: number;
}
