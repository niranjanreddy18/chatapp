import Home from './Home';

function Chat() {
  // Sidebar navigation targets /chat, so it must render the same live
  // workspace as /home rather than a static placeholder.
  return <Home />;
}

export default Chat;
