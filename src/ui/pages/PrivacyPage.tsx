/**
 * Privacy policy page. Hosted at /privacy on the web build and accessible
 * from inside the native app via the footer link, which is the URL the
 * Apple / Google store listings reference.
 *
 * The copy below is the authoritative version (English). Keep it accurate
 * to what the code actually does — both stores cross-check the policy
 * against the data your build accesses.
 */
const CONTACT_EMAIL = 'nzcheez@gmail.com';
const LAST_UPDATED = '2026-05-13';

export function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 text-slate-700 dark:text-slate-200">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <Section title="Summary">
        <p>
          Cubist is a free Rubik&apos;s Cube solver and tutor. The app developer
          does <strong>not</strong> collect any personal information from you.
          No account, no analytics, no telemetry. Cube states, scans, and
          progress live on your device.
        </p>
        <p>
          The app shows ads via Google AdMob to keep itself free. When ads are
          shown, AdMob collects limited information described below. You can
          opt out of personalized ads at any time using your device&apos;s
          privacy settings (or the consent prompt the app shows you).
        </p>
      </Section>

      <Section title="Information we collect ourselves">
        <p>None. Cubist has no servers and no analytics SDK.</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>No sign-up, no account, no login.</li>
          <li>
            Cube colour input, scans, and solve history are stored on your
            device only.
          </li>
          <li>
            The camera feature processes frames locally to detect sticker
            colours. Images <strong>are not uploaded</strong> anywhere.
          </li>
        </ul>
      </Section>

      <Section title="Information collected by Google AdMob (our ad provider)">
        <p>
          Cubist displays ads through Google AdMob. AdMob may collect the
          following while the app is in use:
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Advertising identifier (IDFA on iOS, AAID on Android), only if you
            consent. Apple&apos;s App Tracking Transparency prompt and the
            Android privacy settings control this.
          </li>
          <li>IP address and approximate, IP-derived geographic location.</li>
          <li>
            Limited app-usage signals used for ad delivery, frequency capping,
            fraud prevention, and aggregate reporting.
          </li>
        </ul>
        <p>
          Google&apos;s use of this data is governed by the{' '}
          <a
            className="text-indigo-600 underline decoration-indigo-300 hover:text-indigo-500 dark:text-indigo-300"
            href="https://policies.google.com/technologies/ads"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Ads Privacy Policy
          </a>
          . Cubist does not have access to or store the data AdMob collects.
        </p>
      </Section>

      <Section title="Your choices">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>iOS:</strong> Choose &quot;Ask App Not to Track&quot; on
            the prompt the app shows on first launch, or change it any time in
            Settings → Privacy &amp; Security → Tracking. Doing so switches
            AdMob to non-personalized ads.
          </li>
          <li>
            <strong>Android:</strong> Settings → Privacy → Ads → &quot;Delete
            advertising ID&quot; opts you out of personalized ads system-wide.
          </li>
          <li>
            <strong>EU / UK users:</strong> On first launch the app shows
            Google&apos;s consent form; you can reject personalized ads there.
            The form is available again from your device&apos;s settings if
            you change your mind.
          </li>
        </ul>
      </Section>

      <Section title="Children">
        <p>
          The app is rated 4+ / Everyone. Cubist does not knowingly target
          children or collect any personal information from them. We do not
          designate Cubist as a child-directed service for AdMob, but if you
          want extra protection for a child user, opt out of personalized ads
          via the device settings above.
        </p>
      </Section>

      <Section title="Permissions the app may request">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Camera</strong> — only when you tap the &quot;Scan&quot;
            button to read your cube&apos;s colours. Frames stay on the device
            and are discarded as soon as the scan completes.
          </li>
          <li>
            <strong>Network</strong> — used to load the app on first install
            and to request ads from AdMob.
          </li>
          <li>
            <strong>Tracking (iOS only)</strong> — see ATT prompt above; only
            used to deliver personalized ads.
          </li>
        </ul>
      </Section>

      <Section title="Data retention">
        <p>
          Because the app developer collects nothing, there is nothing to
          retain on our side. Any cube state you enter is held in your
          device&apos;s app-private storage and deleted when you uninstall the
          app. AdMob&apos;s retention is governed by Google&apos;s policies.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          If we add a feature that changes what data is involved (analytics, a
          login, a cloud-saved cube state, etc.), this page will be updated and
          the &quot;Last updated&quot; date above will move. The store listing
          links to the latest version.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about this policy? Reach out at{' '}
          <a
            className="text-indigo-600 underline decoration-indigo-300 hover:text-indigo-500 dark:text-indigo-300"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 space-y-3 text-sm leading-relaxed">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
      {children}
    </section>
  );
}
