import { useState } from 'react';

export const useLoginModal = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const openLoginModal = () => {
    setIsLoginModalOpen(true);
  };

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
  };

  return {
    isLoginModalOpen,
    openLoginModal,
    closeLoginModal,
  };
}; 