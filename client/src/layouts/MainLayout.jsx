import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import AIAssistant from '../components/AIAssistant';

const MainLayout = () => {
  return (
    <div className="flex h-screen overflow-x-hidden bg-[var(--color-background)] font-sans text-[var(--color-text)] selection:bg-primary/20 selection:text-primary">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-x-hidden relative shadow-2xl z-0">
        <Navbar />
        <main className="flex-1 overflow-y-auto relative scroll-smooth custom-scrollbar bg-[var(--color-background)]">
          <div className="max-w-[1920px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
            <Outlet />
          </div>
        </main>
        <AIAssistant />
      </div>
    </div>
  );
};

export default MainLayout;
