import MainLayout from '../components/layout/MainLayout';
import ConversationEmptyState from '../components/chat/ConversationEmptyState';
import ChatWindow from '../components/chat/ChatWindow';
import { useConversation } from '../context/ConversationContext';

function Home() {
  const { selectedConversation, setSelectedConversation } = useConversation();

  return (
    <MainLayout>
      {selectedConversation ? (
        <ChatWindow onBackMobile={() => setSelectedConversation(null)} />
      ) : (
        <ConversationEmptyState />
      )}
    </MainLayout>
  );
}

export default Home;
