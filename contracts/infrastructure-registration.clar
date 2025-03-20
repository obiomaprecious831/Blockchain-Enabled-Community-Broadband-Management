;; Infrastructure Registration Contract
;; Records details of network equipment

;; Define data variables
(define-data-var contract-owner principal tx-sender)

;; Define data maps
(define-map equipment-registry
  { equipment-id: (string-ascii 36) }
  {
    name: (string-ascii 64),
    type: (string-ascii 32),
    model: (string-ascii 64),
    serial-number: (string-ascii 64),
    purchase-date: uint,
    warranty-end-date: uint,
    location: (string-ascii 128),
    responsible-party: principal,
    status: (string-ascii 16)
  }
)

(define-map equipment-history
  { equipment-id: (string-ascii 36), timestamp: uint }
  {
    action: (string-ascii 32),
    details: (string-ascii 256),
    performed-by: principal
  }
)

;; Define error codes
(define-constant ERR-NOT-AUTHORIZED u1)
(define-constant ERR-ALREADY-EXISTS u2)
(define-constant ERR-DOES-NOT-EXIST u3)

;; Read-only functions
(define-read-only (get-equipment-details (equipment-id (string-ascii 36)))
  (map-get? equipment-registry { equipment-id: equipment-id })
)

(define-read-only (get-equipment-history (equipment-id (string-ascii 36)) (timestamp uint))
  (map-get? equipment-history { equipment-id: equipment-id, timestamp: timestamp })
)

(define-read-only (get-contract-owner)
  (var-get contract-owner)
)

;; Public functions
(define-public (register-equipment
    (equipment-id (string-ascii 36))
    (name (string-ascii 64))
    (type (string-ascii 32))
    (model (string-ascii 64))
    (serial-number (string-ascii 64))
    (purchase-date uint)
    (warranty-end-date uint)
    (location (string-ascii 128))
    (responsible-party principal)
  )
  (begin
    ;; Check if caller is authorized
    (asserts! (or (is-eq tx-sender (var-get contract-owner))
                 (is-eq tx-sender responsible-party))
             (err ERR-NOT-AUTHORIZED))

    ;; Check if equipment already exists
    (asserts! (is-none (map-get? equipment-registry { equipment-id: equipment-id }))
             (err ERR-ALREADY-EXISTS))

    ;; Add equipment to registry
    (map-set equipment-registry
      { equipment-id: equipment-id }
      {
        name: name,
        type: type,
        model: model,
        serial-number: serial-number,
        purchase-date: purchase-date,
        warranty-end-date: warranty-end-date,
        location: location,
        responsible-party: responsible-party,
        status: "active"
      }
    )

    ;; Add to history
    (map-set equipment-history
      { equipment-id: equipment-id, timestamp: block-height }
      {
        action: "registered",
        details: "Initial registration",
        performed-by: tx-sender
      }
    )

    (ok true)
  )
)

(define-public (update-equipment-status
    (equipment-id (string-ascii 36))
    (new-status (string-ascii 16))
  )
  (let (
    (equipment (unwrap! (map-get? equipment-registry { equipment-id: equipment-id }) (err ERR-DOES-NOT-EXIST)))
  )
    ;; Check if caller is authorized
    (asserts! (or (is-eq tx-sender (var-get contract-owner))
                 (is-eq tx-sender (get responsible-party equipment)))
             (err ERR-NOT-AUTHORIZED))

    ;; Update equipment status
    (map-set equipment-registry
      { equipment-id: equipment-id }
      (merge equipment { status: new-status })
    )

    ;; Add to history
    (map-set equipment-history
      { equipment-id: equipment-id, timestamp: block-height }
      {
        action: "status-update",
        details: (concat "Status changed to " new-status),
        performed-by: tx-sender
      }
    )

    (ok true)
  )
)

(define-public (update-equipment-location
    (equipment-id (string-ascii 36))
    (new-location (string-ascii 128))
  )
  (let (
    (equipment (unwrap! (map-get? equipment-registry { equipment-id: equipment-id }) (err ERR-DOES-NOT-EXIST)))
  )
    ;; Check if caller is authorized
    (asserts! (or (is-eq tx-sender (var-get contract-owner))
                 (is-eq tx-sender (get responsible-party equipment)))
             (err ERR-NOT-AUTHORIZED))

    ;; Update equipment location
    (map-set equipment-registry
      { equipment-id: equipment-id }
      (merge equipment { location: new-location })
    )

    ;; Add to history
    (map-set equipment-history
      { equipment-id: equipment-id, timestamp: block-height }
      {
        action: "location-update",
        details: (concat "Location changed to " new-location),
        performed-by: tx-sender
      }
    )

    (ok true)
  )
)

(define-public (transfer-responsibility
    (equipment-id (string-ascii 36))
    (new-responsible-party principal)
  )
  (let (
    (equipment (unwrap! (map-get? equipment-registry { equipment-id: equipment-id }) (err ERR-DOES-NOT-EXIST)))
  )
    ;; Check if caller is authorized
    (asserts! (or (is-eq tx-sender (var-get contract-owner))
                 (is-eq tx-sender (get responsible-party equipment)))
             (err ERR-NOT-AUTHORIZED))

    ;; Update responsible party
    (map-set equipment-registry
      { equipment-id: equipment-id }
      (merge equipment { responsible-party: new-responsible-party })
    )

    ;; Add to history
    (map-set equipment-history
      { equipment-id: equipment-id, timestamp: block-height }
      {
        action: "responsibility-transfer",
        details: "Responsibility transferred to new party",
        performed-by: tx-sender
      }
    )

    (ok true)
  )
)

;; Contract initialization
(define-public (set-contract-owner (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (var-set contract-owner new-owner)
    (ok true)
  )
)

