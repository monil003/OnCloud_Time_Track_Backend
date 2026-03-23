import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Header = () => {
  const { user, logout } = useContext(AuthContext);

  if (!user) return null;

  return (
    <header className="header">
      <div className="header-nav">
        <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Time</NavLink>
        <NavLink to="/projects" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Projects</NavLink>
      </div>
      <div className="user-menu" style={{ cursor: 'pointer' }} onClick={logout} title="Click to Logout">
        <div className="avatar">
          {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
        </div>
        <span>{user.name?.toLowerCase()}</span>
      </div>
    </header>
  );
};

export default Header;
