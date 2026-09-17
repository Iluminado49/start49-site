# DNS cutover: Webflow -> GitHub Pages

## Where DNS actually lives (checked 2026-09-17)

The domain is registered at Namecheap, but Namecheap does NOT hold the records.
Namecheap shows NAMESERVERS = "Custom DNS" pointing at **AWS Route 53**:

    ns-393.awsdns-49.com
    ns-958.awsdns-55.net
    ns-1244.awsdns-27.org
    ns-2042.awsdns-63.co.uk

So every record below is edited in the **Route 53 hosted zone for start49.com**,
not in Namecheap's Advanced DNS tab.

## Live zone snapshot (before cutover)

    start49.com.      A      (none - apex has no address record)
    www.start49.com.  CNAME  proxy-ssl.webflow.com.        TTL 300
    start49.com.      MX     1  aspmx.l.google.com.
                             5  alt1.aspmx.l.google.com.
                             5  alt2.aspmx.l.google.com.
                             10 alt3.aspmx.l.google.com.
                             10 alt4.aspmx.l.google.com.
                             15 jp7cw6w77i76ydnoa7tc2tqyo4uxeag5mbqx3ecmy3tmi5lrofpq.mx-verification.google.com.
    start49.com.      TXT    atlassian-domain-verification=iANx4sbzjtrMN6hCGTxX8Anyf34aUQsF8catj73hOKeAPr7BtBvsI8Rx00WzweFR

Mail is Google Workspace. **Do not touch MX or TXT** - hey@start49.com breaks if you do.

## Changes to make in Route 53

1. Create record, name blank (apex `start49.com`), type **A**, TTL 3600, four values:

       185.199.108.153
       185.199.109.153
       185.199.110.153
       185.199.111.153

2. Edit the existing `www` **CNAME**: change the value from
   `proxy-ssl.webflow.com` to **`iluminado49.github.io`** (TTL 3600).

Nothing else changes.

## Then, in the repo

3. Add a `CNAME` file at the site root containing `www.start49.com`
   (build step - see build/pages.json) and push.
4. GitHub repo -> Settings -> Pages -> Custom domain -> `www.start49.com` -> Save,
   wait for the certificate, then tick **Enforce HTTPS**.
5. Leave Webflow running a week or two, then cancel.
