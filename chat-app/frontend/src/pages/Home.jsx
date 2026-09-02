import MainLayout from '../components/layout/MainLayout';
import ConversationEmptyState from '../components/chat/ConversationEmptyState';
import ChatWindow from '../components/chat/ChatWindow';
import { useConversation } from '../context/ConversationContext';

function Home() {
  const { selectedConversation, setSelectedConversation, conversations, loading } = useConversation();

  const hasConversations = loading || conversations.length > 0;

  return (
    <MainLayout>
      {selectedConversation ? (
        <ChatWindow onBackMobile={() => setSelectedConversation(null)} />
      ) : (
        <ConversationEmptyState hasConversations={hasConversations} />
      )}
    </MainLayout>
  );
}

export default Home;
