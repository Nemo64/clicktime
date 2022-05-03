import { withIronSessionApiRoute, withIronSessionSsr } from "iron-session/next";
import { IronSessionOptions } from "iron-session";
import { GetServerSideProps, NextApiHandler } from "next";

declare module "iron-session" {
  interface IronSessionData {
    user: {
      access_token: string;
    };
  }
}

const sessionOptions: IronSessionOptions = {
  password: "complex_password_at_least_32_characters_long",
  cookieName: "session",
  // secure: true should be used in production (HTTPS) but can't be used in development (HTTP)
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
};

export function withSessionRoute(handler: NextApiHandler) {
  return withIronSessionApiRoute(handler, sessionOptions);
}

export function withSessionSsr(handler: GetServerSideProps) {
  return withIronSessionSsr(handler, sessionOptions);
}
