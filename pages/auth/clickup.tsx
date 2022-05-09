import { withSessionSsr } from "../../src/session";
import Head from "next/head";

interface Props {
  error: string;
}

export default function AuthClickUp({ error }: Props) {
  return (
    <div>
      <Head>
        <title>Auth issue</title>
        <meta name="robots" content="noindex" />
      </Head>

      <p>{error}</p>
    </div>
  );
}

export const getServerSideProps = withSessionSsr(async ({ query, req }) => {
  if (!query.code) {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  const response = await fetch(
    `https://api.clickup.com/api/v2/oauth/token?${new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_CLICKUP_CLIENT_ID as string,
      client_secret: process.env.CLICKUP_CLIENT_SECRET as string,
      code: query.code as string,
    })}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (response.status !== 200) {
    const props: Props = {
      error: response.statusText,
    };

    return { props };
  }

  const { access_token } = await response.json();
  req.session.user = { access_token };
  await req.session.save();

  return {
    redirect: {
      destination: "/table",
      permanent: false,
    },
  };
});
