import Head from "next/head";

import { AppLayout } from "../components/AppLayout";
import { ChatInterface } from "../components/ChatInterface";
import { PageIntro } from "../components/ui";

const ChatPage = () => {
  return (
    <>
      <Head>
        <title>AI Assistant | EdXplore</title>
      </Head>
      <AppLayout title="AI Assistant">
        <PageIntro
          eyebrow="AI workspace"
          title="Ask student questions in natural language"
          description="Use the integrated assistant to explore weak subjects, attendance patterns, and student-specific questions through a cleaner chat workspace."
        />
        <ChatInterface />
      </AppLayout>
    </>
  );
};

export default ChatPage;

