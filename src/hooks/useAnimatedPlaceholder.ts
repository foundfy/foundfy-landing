"use client";

import { useEffect, useState } from "react";

const PLACEHOLDER_DOMAINS = [
  "yourwebsite.com",
  "acme.com",
  "foundfy.me",
  "yourbrand.io",
];

export function useAnimatedPlaceholder(active: boolean) {
  const [displayText, setDisplayText] = useState("");
  const [domainIndex, setDomainIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!active) {
      return;
    }

    const currentDomain = PLACEHOLDER_DOMAINS[domainIndex];
    const isComplete = displayText === currentDomain;
    const pauseAtEnd = 2200;
    const pauseBetween = 320;
    const typeSpeed = 72;
    const deleteSpeed = 42;

    const timeout = window.setTimeout(
      () => {
        if (!isDeleting) {
          if (!isComplete) {
            setDisplayText(currentDomain.slice(0, displayText.length + 1));
            return;
          }

          setIsDeleting(true);
          return;
        }

        if (displayText.length > 0) {
          setDisplayText(displayText.slice(0, -1));
          return;
        }

        setIsDeleting(false);
        setDomainIndex((index) => (index + 1) % PLACEHOLDER_DOMAINS.length);
      },
      !isDeleting
        ? isComplete
          ? pauseAtEnd
          : typeSpeed
        : displayText.length === 0
          ? pauseBetween
          : deleteSpeed,
    );

    return () => window.clearTimeout(timeout);
  }, [active, displayText, domainIndex, isDeleting]);

  return displayText;
}
