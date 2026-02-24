"use client";

import { useState, useEffect } from 'react';

const keyframes = `
  @keyframes dot-pulse {
    0%, 80%, 100% {
      transform: scale(0);
      opacity: 0;
    }
    40% {
      transform: scale(1.0);
      opacity: 1;
    }
  }
`;

const LoadingSpinner = () => {
  // To control the fade-out effect and eventual unmounting
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isRendered, setIsRendered] = useState(true);

  useEffect(() => {
    // Simulate content loading for demonstration purposes
    const fadeOutTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 1500); // Display the spinner for 1.5 seconds

    // Unmount the component after the fade-out transition completes (500ms duration)
    const unmountTimer = setTimeout(() => {
      setIsRendered(false);
    }, 1500 + 500);

    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  if (!isRendered) {
    return null;
  }

  return (
    <>
      <style>{keyframes}</style>
      <div
        className={`fixed inset-0 z-[9999] flex items-center justify-center bg-[#0f1117]/95 transition-opacity duration-500 ease-in-out ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}
        // The 'show' class functionality is handled by conditional opacity
        data-show={!isFadingOut}
      >
        <div className="flex space-x-2">
          <div
            className="h-3 w-3 rounded-full bg-white"
            style={{ animation: 'dot-pulse 1.4s infinite ease-in-out both', animationDelay: '0s' }}
          />
          <div
            className="h-3 w-3 rounded-full bg-white"
            style={{ animation: 'dot-pulse 1.4s infinite ease-in-out both', animationDelay: '0.2s' }}
          />
          <div
            className="h-3 w-3 rounded-full bg-white"
            style={{ animation: 'dot-pulse 1.4s infinite ease-in-out both', animationDelay: '0.4s' }}
          />
        </div>
      </div>
    </>
  );
};

export default LoadingSpinner;