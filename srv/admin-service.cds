using { error.outbox as outbox } from '../db/model';

/**
 * Error Outbox Admin Service
 *
 * Exposes captured errors for administrative review, filtering, and deletion.
 * Served automatically by the cds-error-outbox plugin at /error-outbox/.
 *
 * Requires 'admin' role. In development (cds.env.profiles includes 'development'),
 * CAP automatically grants all roles via the mock auth strategy.
 */
@path: 'error-outbox'
service ErrorOutboxAdminService @(requires: 'error-outbox-admin') {

  entity Errors as projection on outbox.Errors {
    *
  } actions {

    /**
     * Mark selected error records as acknowledged (sets sent = true).
     * Useful for silencing known/expected errors without waiting for the scheduler.
     */
    action acknowledge();
  };

  /**
   * Delete all records that have already been sent.
   * Bound to the entity set level (unbound action on service).
   */
  action purgeSent() returns String;
}
