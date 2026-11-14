#!/usr/bin/env bash
# Builds a fresh shop with the demo catalog inside a DDEV project, without a
# browser: downloads the release, runs the command line installer, pins the
# back-office folder name, turns e-mail off, creates the accounts the suite
# signs in with, and exports LAUNCH_URL and ADMIN_FOLDER for the test job.
#
# Settings (environment variables, all optional):
#   SHOP_VERSION     the release to install                (default 9.2.1)
#   PHP_VERSION      the PHP version of the container      (default 8.3; 9.x runs on 8.1 to 8.5)
#   PROJECT_NAME     the DDEV project name                 (default prestashop-ci)
#   SITE_DIR         the project folder                    (default a new temporary folder)
#   ADMIN_FOLDER     the back-office folder name           (default admin-steps)
#   ADMIN_EMAIL, ADMIN_PASSWORD        the SuperAdmin      (default admin@example.com / Admin123456789!)
#   SALESMAN_EMAIL, SALESMAN_PASSWORD  an employee with the Salesman profile
#   CUSTOMER_EMAIL, CUSTOMER_PASSWORD  a customer with one address
#   SHOPPER_EMAIL, SHOPPER_PASSWORD    a second customer with one address
# The accounts are configuration: they are created once here and named in
# cucumber.js; the features never create or delete employees.
#
# Nothing outside the shop is connected: only the modules of the open source
# release are installed (no marketplace, account, hosted checkout, marketing or
# AI module of the downloaded edition), and the shop never sends an e-mail.
set -euo pipefail

SHOP_VERSION="${SHOP_VERSION:-9.2.1}"
PHP_VERSION="${PHP_VERSION:-8.3}"
PROJECT_NAME="${PROJECT_NAME:-prestashop-ci}"
ADMIN_FOLDER="${ADMIN_FOLDER:-admin-steps}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123456789!}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The modules of the open source release (its composer.json), the only ones installed.
MODULES="blockreassurance,blockwishlist,contactform,dashactivity,dashgoals,dashproducts,dashtrends,graphnvd3,gridhtml,gsitemap,pagesnotfound,productcomments,ps_apiresources,ps_banner,ps_bestsellers,ps_brandlist,ps_cashondelivery,ps_categoryproducts,ps_categorytree,ps_checkpayment,ps_contactinfo,ps_crossselling,ps_currencyselector,ps_customeraccountlinks,ps_customersignin,ps_customtext,ps_dataprivacy,ps_emailalerts,ps_emailsubscription,ps_facetedsearch,ps_faviconnotificationbo,ps_featuredproducts,ps_googleanalytics,ps_imageslider,ps_languageselector,ps_linklist,ps_mainmenu,ps_newproducts,ps_onepagecheckout,ps_searchbar,ps_sharebuttons,ps_shoppingcart,ps_socialfollow,ps_specials,ps_supplierlist,ps_themecusto,ps_viewedproduct,ps_wirepayment,psgdpr,statsbestcategories,statsbestcustomers,statsbestmanufacturers,statsbestproducts,statsbestsuppliers,statsbestvouchers,statscarrier,statscatalog,statscheckup,statsdata,statsforecast,statsnewsletter,statspersonalinfos,statsproduct,statsregistrations,statssales,statssearch,statsstock"

SITE_DIR="${SITE_DIR:-$(mktemp -d)}"
mkdir -p "$SITE_DIR/public"
cd "$SITE_DIR"

ddev config --project-type=php --project-name="$PROJECT_NAME" --docroot=public \
  --php-version="$PHP_VERSION" --webserver-type=apache-fpm --database=mariadb:10.11
ddev start

# The release list of the project gives the archive of each version and its checksum.
RELEASE="$(curl -sL https://api.prestashop-project.org/prestashop | python3 -c "
import json, sys
for release in json.load(sys.stdin):
    if release['version'] == '$SHOP_VERSION':
        print(release['zip_download_url'], release['zip_md5'])
        break
")"
ZIP_URL="${RELEASE% *}"
ZIP_MD5="${RELEASE#* }"
test -n "$ZIP_URL" || { echo "Release $SHOP_VERSION is not in the release list" >&2; exit 1; }
curl -sL -o release.zip "$ZIP_URL"
echo "$ZIP_MD5  release.zip" | md5sum -c -
# The download holds the shop as an inner archive next to a web unpacker.
unzip -q release.zip prestashop.zip -d .
unzip -q prestashop.zip -d public
rm -f release.zip prestashop.zip

SITE_HOST="$(ddev describe -j | python3 -c "import json,sys; print(json.load(sys.stdin)['raw']['hostname'])")"
SITE_URL="https://$SITE_HOST"

ddev exec "php public/install/index_cli.php --domain=$SITE_HOST --db_server=db --db_name=db \
  --db_user=db --db_password=db --prefix=ps_ --name='Webship Shop' --country=us --language=en \
  --timezone=UTC --firstname=Shop --lastname=Admin --email=$ADMIN_EMAIL --password='$ADMIN_PASSWORD' \
  --ssl=1 --rewrite=1 --fixtures=1 --modules=$MODULES"

# The installer removes install/ and gives the back office a random folder name.
# Pin it, so the suite knows the back-office address.
rm -rf public/install
INSTALLED_ADMIN="$(find public -maxdepth 1 -type d -name 'admin*' ! -name 'admin-api' ! -name "$ADMIN_FOLDER" | head -1)"
if [ -n "$INSTALLED_ADMIN" ]; then
  mv "$INSTALLED_ADMIN" "public/$ADMIN_FOLDER"
fi

# No e-mail leaves the shop (3 = never send), and the back office does not ask
# for anything from outside.
ddev mysql -e "UPDATE ps_configuration SET value='3' WHERE name='PS_MAIL_METHOD'"

cp "$SCRIPT_DIR/provision-accounts.php" public/provision-accounts.php
ddev exec -d /var/www/html/public env \
  SALESMAN_EMAIL="${SALESMAN_EMAIL:-}" SALESMAN_PASSWORD="${SALESMAN_PASSWORD:-}" \
  CUSTOMER_EMAIL="${CUSTOMER_EMAIL:-}" CUSTOMER_PASSWORD="${CUSTOMER_PASSWORD:-}" \
  SHOPPER_EMAIL="${SHOPPER_EMAIL:-}" SHOPPER_PASSWORD="${SHOPPER_PASSWORD:-}" \
  php provision-accounts.php
rm -f public/provision-accounts.php

ddev exec "rm -rf public/var/cache/*"
curl -skL -o /dev/null "$SITE_URL/"
curl -skL -o /dev/null "$SITE_URL/$ADMIN_FOLDER/"

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "LAUNCH_URL=$SITE_URL" >> "$GITHUB_ENV"
  echo "ADMIN_FOLDER=$ADMIN_FOLDER" >> "$GITHUB_ENV"
fi
echo "Built shop $SHOP_VERSION at $SITE_URL (back office: $SITE_URL/$ADMIN_FOLDER/)"
