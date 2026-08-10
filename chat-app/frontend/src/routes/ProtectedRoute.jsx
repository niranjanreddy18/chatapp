import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ConversationProvider } from '../context/ConversationContext';
import { MessageProvider } from '../context/MessageContext';

function ProtectedRoute() {
  const { authReady, isAuthenticated } = useAuth();

  if (!authReady) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ConversationProvider>
      <MessageProvider>
        <Outlet />
      </MessageProvider>
    </ConversationProvider>
  );
}

export default ProtectedRoute;
