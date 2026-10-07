import "server-only";
import { auth } from "@repo/auth/server";
import { Svix } from "svix";
import { keys } from "../keys";

const svixToken = keys().SVIX_TOKEN;

export const send = async (eventType: string, payload: object) => {
  if (!svixToken) {
    throw new Error("SVIX_TOKEN is not set");
  }

  const svix = new Svix(svixToken);
  const { userId } = await auth();

  if (!userId) {
    return;
  }

  return svix.message.create(userId, {
    eventType,
    payload: {
      eventType,
      ...payload,
    },
    application: {
      name: userId,
      uid: userId,
    },
  });
};

export const getAppPortal = async () => {
  if (!svixToken) {
    throw new Error("SVIX_TOKEN is not set");
  }

  const svix = new Svix(svixToken);
  const { userId } = await auth();

  if (!userId) {
    return;
  }

  return svix.authentication.appPortalAccess(userId, {
    application: {
      name: userId,
      uid: userId,
    },
  });
};
