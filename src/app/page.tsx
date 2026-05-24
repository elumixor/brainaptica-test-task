import { Chat } from "@/components/chat";
import { loadHistory } from "@/lib/load-history";
import { getOrCreateSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const sessionId = await getOrCreateSession();
  const { initialMessages, initialEmotions } = await loadHistory(sessionId);
  return <Chat initialMessages={initialMessages} initialEmotions={initialEmotions} />;
}
