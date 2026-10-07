import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import Page from "../app/(unauthenticated)/sign-in/page";

test("Sign In Page", async () => {
  const { container } = render(
    await Page({ searchParams: Promise.resolve({}) })
  );
  expect(container).toBeDefined();
});
