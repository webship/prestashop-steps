<?php
/**
 * Creates the accounts the suite signs in with, without the browser:
 * one employee with a limited profile and the customers with one address each.
 * The installer already created the SuperAdmin. Run from the shop root:
 *   php provision-accounts.php
 * It is safe to run twice: an account that exists is left as it is.
 *
 * Environment (all optional, the defaults are the ones in cucumber.js):
 *   SALESMAN_EMAIL, SALESMAN_PASSWORD      the employee with the Salesman profile
 *   CUSTOMER_EMAIL, CUSTOMER_PASSWORD      the first customer
 *   SHOPPER_EMAIL, SHOPPER_PASSWORD        the second customer
 */
require getcwd() . '/config/config.inc.php';

use PrestaShop\PrestaShop\Adapter\ServiceLocator;
use PrestaShop\PrestaShop\Core\Crypto\Hashing;

Shop::setContext(Shop::CONTEXT_ALL);
$crypto = ServiceLocator::get(Hashing::class);
$langId = (int) Configuration::get('PS_LANG_DEFAULT');

function fail($what, $object)
{
    fwrite(STDERR, "Could not create $what: " . json_encode($object->validateFields(false, true)) . "\n");
    exit(1);
}

// The employee: profile 4 is "Salesman" on a default install (customers and orders, no catalog, no modules).
$salesmanEmail = getenv('SALESMAN_EMAIL') ?: 'salesman@example.com';
if (!Employee::employeeExists($salesmanEmail)) {
    $profileId = (int) Db::getInstance()->getValue(
        'SELECT id_profile FROM ' . _DB_PREFIX_ . "profile_lang WHERE name = 'Salesman' AND id_lang = " . $langId
    );
    $employee = new Employee();
    $employee->firstname = 'Sam';
    $employee->lastname = 'Salesman';
    $employee->email = $salesmanEmail;
    $employee->passwd = $crypto->hash(getenv('SALESMAN_PASSWORD') ?: 'Salesman123456789!');
    $employee->id_profile = $profileId;
    $employee->id_lang = $langId;
    $employee->active = true;
    $employee->bo_theme = 'default';
    $employee->default_tab = (int) Tab::getIdFromClassName('AdminOrders');
    if (!$employee->add()) {
        fail('the employee', $employee);
    }
    echo "Employee $salesmanEmail (Salesman)\n";
}

// The customers, each with one address in the shop's default country.
$countryId = (int) Configuration::get('PS_COUNTRY_DEFAULT');
$stateId = (int) State::getIdByIso('FL', $countryId);
$customers = [
    [getenv('CUSTOMER_EMAIL') ?: 'customer@example.com', getenv('CUSTOMER_PASSWORD') ?: 'Customer123456789!', 'Clara', 'Customer'],
    [getenv('SHOPPER_EMAIL') ?: 'shopper@example.com', getenv('SHOPPER_PASSWORD') ?: 'Shopper123456789!', 'Simon', 'Shopper'],
];
foreach ($customers as [$email, $password, $firstname, $lastname]) {
    if (Customer::customerExists($email)) {
        continue;
    }
    $customer = new Customer();
    $customer->firstname = $firstname;
    $customer->lastname = $lastname;
    $customer->email = $email;
    $customer->passwd = $crypto->hash($password);
    $customer->id_default_group = (int) Configuration::get('PS_CUSTOMER_GROUP');
    $customer->active = true;
    $customer->newsletter = false;
    $customer->optin = false;
    if (!$customer->add()) {
        fail('the customer', $customer);
    }
    $address = new Address();
    $address->id_customer = (int) $customer->id;
    $address->id_country = $countryId;
    $address->id_state = $stateId;
    $address->alias = 'Home';
    $address->firstname = $firstname;
    $address->lastname = $lastname;
    $address->address1 = '16 Main Street';
    $address->city = 'Miami';
    $address->postcode = '33133';
    $address->phone = '5550100';
    if (!$address->add()) {
        fail('the address', $address);
    }
    echo "Customer $email with an address\n";
}
