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

## Complete zone inventory (verified 2026-09-17)

Enumerated by direct DNS queries plus certificate-transparency history.
Certificate transparency shows only `start49.com`, `www.start49.com` and a
wildcard ever issued. Every other common subdomain (mail, blog, app, api, jira,
crm, dev, staging, portal, docs, autodiscover, ftp, careers, cdn) returns
NXDOMAIN - they do not exist in the zone.

The zone contains exactly four record sets:

    start49.com.                  MX    1  aspmx.l.google.com.
                                        5  alt1.aspmx.l.google.com.
                                        5  alt2.aspmx.l.google.com.
                                        10 alt3.aspmx.l.google.com.
                                        10 alt4.aspmx.l.google.com.
                                        15 jp7cw6w77i76ydnoa7tc2tqyo4uxeag5mbqx3ecmy3tmi5lrofpq.mx-verification.google.com.

    start49.com.                  TXT   atlassian-domain-verification=iANx4sbzjtrMN6hCGTxX8Anyf34aUQsF8catj73hOKeAPr7BtBvsI8Rx00WzweFR

    google._domainkey.start49.com. TXT  v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCIAoGrLgc/3dwgVjdQXFjtWDLWiesPs2PkUedgeBVDRBXCSgRjsNjRJEBqEJCC4B4EPsWXRHDlRfbE/KfgM+F4W9l51qXKhCxAd3I2CyDeqO2VLMHvOwt/X149l4pa4K+W8JV8tTni+7yKYLLvmfQGzEP0kSVF10byi+iwBAdWIQIDAQAB

    www.start49.com.              CNAME proxy-ssl.webflow.com.   TTL 300

Notes:
- The apex has **no** A record. `http://start49.com` does not resolve today;
  only `www` works.
- There is **no SPF record** and **no DMARC record**. Mail is Google Workspace
  with DKIM signing only. Worth adding SPF + DMARC once DNS is somewhere we
  control, but that is a separate job from this cutover.
- There is no CAA record, so any CA may issue - GitHub Pages certificates
  will work without changes.

Mail is Google Workspace. The MX records and both TXT records must survive the
move exactly as written above, or hey@start49.com breaks.

## Changes to make

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
