import { NavLink } from 'react-router-dom';
import usePagedRequest from '../../hooks/usePagedRequest';
import Icon from '../icon/Icon';
import styles from './Navigation.module.scss';
import SettingsMenu from './SettingsMenu';
import { classList } from '../../utils';
import type { Chat } from '../../types/Chat';
import Loading from '../feedback/Loading';
import { useEventBus } from '../../hooks/useEventBus';

const Navigation = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {

  const classNames = classList(styles.navigation, className);

  const activeClassName = ({ isActive }: { isActive: boolean }) => isActive ? styles.active : '';

  const { data: chats, setData: setChats, loading, loadMore } = usePagedRequest<Chat>('/chats/history');

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight) {
      loadMore();
    }
  };

  useEventBus('chat:updated', (payload: Chat) => {
    setChats(prev => {
      const currentData = prev || [];
      const existing = currentData.find(m => m._id === payload._id);
      if (existing) {
        return currentData.map(m => m._id === payload._id ? payload : m);
      } else {
        return [payload, ...currentData];
      }
    });
  });

  return (
    <nav className={classNames} {...props} onScroll={handleScroll}>

      <div className={styles.logo}>
        <span>Chat Jumpstart</span>
      </div>

      <div className={styles.menu}>

        <NavLink to="/">
          <Icon name="edit_square" />
          New chat
        </NavLink>

        <NavLink to="/documents" className={activeClassName}>
          <Icon name="library_books" />
          Document library
        </NavLink>

        <NavLink to="/logs" className={activeClassName}>
          <Icon name="bug_report" />
          Logs
        </NavLink>

      </div>

      <div className={styles.history}>

        <h2>Recent Chats</h2>

        {loading && <Loading size="small" color="gray" />}

        {chats?.map((chat: Chat) => (
          <NavLink className={activeClassName} to={`/chat/${chat._id}`} key={chat._id}>
            {chat.title}
          </NavLink>
        ))}

        {chats?.length === 0 && <p className={styles.noChats}>No chats yet</p>}

      </div>

      <div className={styles.spacer} />

      <div className={styles.footer}>
        <SettingsMenu />
      </div>

    </nav>
  );
};

export default Navigation;

