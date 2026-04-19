import { CollaborateurPageClient } from "@/components/collaborateur/CollaborateurPageClient";
import { getAllAgents } from "@/lib/services/agentService";
import { getAllProjects } from "@/lib/services/projectService";
import { startTimer } from "@/lib/utils/perf";

export const revalidate = 30;

export default async function CollaborateurPage() {
  const stop = startTimer("CollaborateurPage/load");
  const [agents, projects] = await Promise.all([getAllAgents(), getAllProjects()]);
  const activeProjectsCount = projects.filter((project) => project.status !== "released").length;
  stop({ agents: agents.length, projects: projects.length });

  return (
    <CollaborateurPageClient
      initialAgents={agents}
      initialActiveProjectsCount={activeProjectsCount}
    />
  );
}
