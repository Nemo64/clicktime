import Head from "next/head";
import { Button } from "../components/button";

export default function Home() {
  const login = () => {
    location.href = `https://app.clickup.com/api?${new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_CLICKUP_CLIENT_ID as string,
      redirect_uri: `${location.origin}/auth/clickup/`,
    })}`;
  };

  return (
    <div>
      <Head>
        <title>Home</title>
      </Head>

      <h1>Hello world</h1>
      <Button
        onClick={login}
        className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white"
        title={process.env.NEXT_PUBLIC_CLICKUP_CLIENT_ID}
      >
        Login with ClickUp
      </Button>
    </div>
  );
}
