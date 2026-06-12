"use client";

import React from "react";
import { AlertCircle } from "lucide-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-bg p-8">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-like/10 border border-like/20">
              <AlertCircle className="h-7 w-7 text-like" strokeWidth={2} />
            </div>
            <h1 className="text-2xl font-bold text-text-primary">Something went wrong</h1>
            <p className="text-text-secondary text-sm">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-6 py-2.5 rounded-xl bg-accent text-text-inverse font-semibold text-sm hover:bg-accent/90 transition-colors"
              >
                Try again
              </button>
              <button
                onClick={() => { window.location.href = "/login"; }}
                className="px-6 py-2.5 rounded-xl bg-bg-elevated text-text-primary font-semibold text-sm hover:bg-bg transition-colors"
              >
                Go to login
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
