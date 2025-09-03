'use client';

import React, { useEffect, useState } from 'react';

interface ViewTransitionProps {
  children: React.ReactNode;
  transitionKey?: string;
  duration?: number;
  className?: string;
}

export const ViewTransition: React.FC<ViewTransitionProps> = ({
  children,
  transitionKey,
  duration = 300,
  className = ''
}) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayChildren, setDisplayChildren] = useState(children);

  useEffect(() => {
    if (transitionKey !== undefined) {
      setIsTransitioning(true);
      
      const timer = setTimeout(() => {
        setDisplayChildren(children);
        setIsTransitioning(false);
      }, duration / 2);

      return () => clearTimeout(timer);
    } else {
      setDisplayChildren(children);
    }
  }, [transitionKey, children, duration]);

  return (
    <div
      className={`transition-all duration-${duration} ${className} ${
        isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
      }`}
      style={{
        transitionDuration: `${duration}ms`,
        transitionProperty: 'opacity, transform'
      }}
    >
      {displayChildren}
    </div>
  );
};

// Fade transition for smoother content switching
export const FadeTransition: React.FC<{
  children: React.ReactNode;
  show: boolean;
  duration?: number;
  className?: string;
}> = ({ children, show, duration = 300, className = '' }) => {
  const [shouldRender, setShouldRender] = useState(show);

  useEffect(() => {
    if (show) setShouldRender(true);
  }, [show]);

  const handleTransitionEnd = () => {
    if (!show) setShouldRender(false);
  };

  if (!shouldRender) return null;

  return (
    <div
      className={`transition-opacity ${className}`}
      style={{
        opacity: show ? 1 : 0,
        transitionDuration: `${duration}ms`
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      {children}
    </div>
  );
};

// Slide transition for content panels
export const SlideTransition: React.FC<{
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down';
  show: boolean;
  duration?: number;
  className?: string;
}> = ({ 
  children, 
  direction = 'left', 
  show, 
  duration = 300, 
  className = '' 
}) => {
  const getTransform = () => {
    if (!show) {
      switch (direction) {
        case 'left': return 'translateX(-100%)';
        case 'right': return 'translateX(100%)';
        case 'up': return 'translateY(-100%)';
        case 'down': return 'translateY(100%)';
      }
    }
    return 'translate(0)';
  };

  return (
    <div
      className={`transition-all ${className}`}
      style={{
        transform: getTransform(),
        opacity: show ? 1 : 0,
        transitionDuration: `${duration}ms`
      }}
    >
      {children}
    </div>
  );
};

// Stagger transition for lists
export const StaggerTransition: React.FC<{
  children: React.ReactElement[];
  show: boolean;
  staggerDelay?: number;
  duration?: number;
  className?: string;
}> = ({ 
  children, 
  show, 
  staggerDelay = 50, 
  duration = 300,
  className = ''
}) => {
  return (
    <div className={className}>
      {React.Children.map(children, (child, index) => (
        <div
          className="transition-all"
          style={{
            opacity: show ? 1 : 0,
            transform: show ? 'translateY(0)' : 'translateY(20px)',
            transitionDuration: `${duration}ms`,
            transitionDelay: `${index * staggerDelay}ms`
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
};

// Cross-fade transition for switching between different content
export const CrossFadeTransition: React.FC<{
  children: React.ReactNode;
  transitionKey: string | number;
  duration?: number;
  className?: string;
}> = ({ children, transitionKey, duration = 300, className = '' }) => {
  const [currentKey, setCurrentKey] = useState(transitionKey);
  const [currentChildren, setCurrentChildren] = useState(children);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (transitionKey !== currentKey) {
      setIsTransitioning(true);
      
      setTimeout(() => {
        setCurrentChildren(children);
        setCurrentKey(transitionKey);
        
        setTimeout(() => {
          setIsTransitioning(false);
        }, 50);
      }, duration / 2);
    }
  }, [transitionKey, children, currentKey, duration]);

  return (
    <div
      className={`transition-opacity ${className}`}
      style={{
        opacity: isTransitioning ? 0 : 1,
        transitionDuration: `${duration / 2}ms`
      }}
    >
      {currentChildren}
    </div>
  );
};