"use client";

import * as Toast from "@radix-ui/react-toast";
import React from "react";

import { cn } from "@/lib/utils";
import {
  SuccessIcon,
  ErrorIcon,
  WarningIcon,
  InfoIcon,
  CloseIcon,
} from "./AlertIcons";

interface CustomAlertProps {
  message: string;
  severity: "success" | "error" | "warning" | "info";
  open: boolean;
  onClose: () => void;
}

export const CustomAlert: React.FC<CustomAlertProps> = ({
  message,
  severity,
  open,
  onClose,
}) => {
  const severityStyles = {
    success: {
      root: "border-green-200/80 bg-green-50/95 text-green-950 shadow-green-950/10",
      accent: "bg-green-500",
      iconWrap: "bg-green-100 text-green-700 ring-green-200",
      close:
        "text-green-800/70 hover:bg-green-100 hover:text-green-950 focus-visible:ring-green-600",
    },
    error: {
      root: "border-red-200/80 bg-red-50/95 text-red-950 shadow-red-950/10",
      accent: "bg-red-500",
      iconWrap: "bg-red-100 text-red-700 ring-red-200",
      close:
        "text-red-800/70 hover:bg-red-100 hover:text-red-950 focus-visible:ring-red-600",
    },
    warning: {
      root:
        "border-yellow-200/80 bg-yellow-50/95 text-yellow-950 shadow-yellow-950/10",
      accent: "bg-yellow-500",
      iconWrap: "bg-yellow-100 text-yellow-800 ring-yellow-200",
      close:
        "text-yellow-900/70 hover:bg-yellow-100 hover:text-yellow-950 focus-visible:ring-yellow-600",
    },
    info: {
      root: "border-blue-200/80 bg-blue-50/95 text-blue-950 shadow-blue-950/10",
      accent: "bg-blue-500",
      iconWrap: "bg-blue-100 text-blue-700 ring-blue-200",
      close:
        "text-blue-800/70 hover:bg-blue-100 hover:text-blue-950 focus-visible:ring-blue-600",
    },
  };

  const style = severityStyles[severity];

  const IconComponent = {
    success: SuccessIcon,
    error: ErrorIcon,
    warning: WarningIcon,
    info: InfoIcon,
  }[severity];

  return (
    <Toast.Provider swipeDirection="right" duration={5000}>
      <Toast.Root
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onClose();
        }}
        className={cn(
          "relative grid w-[calc(100vw-2rem)] max-w-[340px] grid-cols-[auto_1fr_auto] items-center gap-2 overflow-hidden rounded-md border py-2 pl-2.5 pr-1.5 shadow-lg backdrop-blur",
          "transition-[transform,opacity] duration-300 ease-out will-change-transform",
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-right-5 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-5 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform data-[swipe=cancel]:duration-200 data-[swipe=cancel]:ease-out data-[swipe=end]:animate-out data-[swipe=end]:slide-out-to-right-full",
          style.root
        )}
      >
        <div className={cn("absolute inset-y-0 left-0 w-1", style.accent)} />

        <div
          className={cn(
            "ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1",
            style.iconWrap
          )}
        >
          <IconComponent className="h-4 w-4" />
        </div>

        <Toast.Title className="min-w-0 text-xs font-semibold leading-4">
          {message}
        </Toast.Title>

        <Toast.Close
          aria-label="Close notification"
          className={cn(
            "rounded-md p-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            style.close
          )}
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </Toast.Close>
      </Toast.Root>

      <Toast.Viewport className="fixed right-3 top-3 z-[9999] flex max-h-screen w-[calc(100vw-1.5rem)] max-w-[340px] flex-col gap-2 outline-none sm:right-4 sm:top-4" />
    </Toast.Provider>
  );
};
