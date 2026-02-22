import React from "react";
import { SignedIn, SignedOut, SignIn, UserButton } from "@clerk/clerk-react";

export default function App() {
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 800 }}>OK-VAL</div>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </header>

      <main style={{ marginTop: 24 }}>
        <SignedOut>
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ margin: "0 0 12px" }}>Sign in</h1>
            <SignIn />
          </div>
        </SignedOut>

        <SignedIn>
          <h1 style={{ margin: "0 0 12px" }}>Dashboard</h1>
          <p>You are signed in. Next: role-gated navigation + API calls.</p>
        </SignedIn>
      </main>
    </div>
  );
}