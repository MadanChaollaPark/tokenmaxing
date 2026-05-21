export default function PrivacyPage() {
  return (
    <main className="policy-page">
      <section>
        <h1>Privacy</h1>
        <p>
          TokenMaxing stores aggregate usage only: provider, model, day, token counts, and estimated cost.
          It does not need prompts, responses, files, chat logs, cookies, or provider API keys.
        </p>
        <p>
          Provider keys entered in the Connect modal are used for one sync request and are not stored by the app.
        </p>
        <p>
          Signed-in users can remove their submitted usage and provider connections from the Connect modal.
        </p>
      </section>
    </main>
  );
}
