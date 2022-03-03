import React from "react";

import { NetworkErrorMessage } from "./NetworkErrorMessage";

export function ConnectWallet({ connectWallet, networkError, dismiss }) {
  return (
    <div className="d-flex h-100 text-center text-white bg-dark">
      <div className="cover-container d-flex w-100 h-100 p-3 mx-auto flex-column">
        <header className="mb-auto"></header>

        <main className="px-3">
          <div className="container">
            <div className="row justify-content-md-center">
              <div className="col-12 text-center">
                {/* Metamask network should be set to Localhost:8545. */}
                {networkError && (
                  <NetworkErrorMessage
                    message={networkError}
                    dismiss={dismiss}
                  />
                )}
              </div>
              <div className="col-6 p-4 text-center">
                <h1>Please connect to your wallet.</h1>
                <button
                  className="btn btn-warning"
                  type="button"
                  onClick={connectWallet}
                >
                  Connect Wallet
                </button>
              </div>
            </div>
          </div>
        </main>

        <footer className="mt-auto text-white-50"></footer>
      </div>
    </div>
  );
}
