import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";

export default function PrivacyPage() {
  return (
    <PageShell className="max-w-3xl space-y-6 px-4 py-6 md:px-6 md:py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium text-rose-800">Your information</p>
        <h1 className="text-3xl font-bold text-deep-plum">Privacy</h1>
        <p className="leading-7 text-gray-700">Here is a plain-language summary of what Her Space stores and who can see it.</p>
      </header>

      <Card as="section" className="space-y-3">
        <h2 className="text-xl font-semibold text-deep-plum">What we store</h2>
        <p className="leading-7 text-gray-800">To provide the service, we store your email address, display name, posts, comments, saves, likes, follows, and journal entries. If you submit reports or suggestions, we store those too so they can be reviewed.</p>
      </Card>

      <Card as="section" className="space-y-3">
        <h2 className="text-xl font-semibold text-deep-plum">Who can see it</h2>
        <ul className="list-disc space-y-3 pl-5 leading-7 text-gray-800">
          <li>Your journal entries are private to you.</li>
          <li>Your saved posts (bookmarks) are private to you.</li>
          <li>Posts and comments you publish are visible to signed-in Her Space members.</li>
          <li>Your profile display name and bio may be visible to signed-in members.</li>
          <li>Administrators may access information needed to operate the service, respond to reports, and keep the community safe.</li>
        </ul>
      </Card>

      <Card as="section" className="space-y-3">
        <h2 className="text-xl font-semibold text-deep-plum">How we use information</h2>
        <p className="leading-7 text-gray-800">We use your information to provide the community and its features, protect the service, and respond to requests. We do not sell your data and we do not show ads.</p>
      </Card>

      <Card as="section" className="space-y-3">
        <h2 className="text-xl font-semibold text-deep-plum">Deleting your account</h2>
        <p className="leading-7 text-gray-800">You can permanently delete your account from Settings. Account deletion removes your account and associated content, including posts, comments, journal entries, and saves, subject to any retention required by law.</p>
      </Card>

      <p className="text-sm leading-6 text-gray-700">Privacy questions? Contact [your contact email].</p>
    </PageShell>
  );
}