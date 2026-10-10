import { createFileRoute } from "@tanstack/react-router";
import { Studio } from "@/studio/studio";

export const Route = createFileRoute("/")({ component: Studio });
