;; Usage Monitoring Contract
;; Tracks bandwidth consumption patterns

(define-data-var admin principal tx-sender)

;; Usage data structure
(define-map bandwidth-usage
  { user: principal, month: uint, year: uint }
  {
    download-gb: uint,
    upload-gb: uint,
    last-updated: uint
  }
)

;; Record bandwidth usage
(define-public (record-usage
    (user principal)
    (month uint)
    (year uint)
    (download-gb uint)
    (upload-gb uint)
  )
  (let
    (
      (current-time block-height)
      (existing-data (map-get? bandwidth-usage { user: user, month: month, year: year }))
    )
    (asserts! (is-eq tx-sender (var-get admin)) (err u403))

    ;; Validate month
    (asserts! (and (>= month u1) (<= month u12)) (err u400))

    (if (is-some existing-data)
      (let
        (
          (current-data (unwrap-panic existing-data))
          (new-download (+ (get download-gb current-data) download-gb))
          (new-upload (+ (get upload-gb current-data) upload-gb))
        )
        (map-set bandwidth-usage
          { user: user, month: month, year: year }
          {
            download-gb: new-download,
            upload-gb: new-upload,
            last-updated: current-time
          }
        )
      )
      (map-set bandwidth-usage
        { user: user, month: month, year: year }
        {
          download-gb: download-gb,
          upload-gb: upload-gb,
          last-updated: current-time
        }
      )
    )
    (ok true)
  )
)

;; Get usage for a specific user and month
(define-read-only (get-usage (user principal) (month uint) (year uint))
  (map-get? bandwidth-usage { user: user, month: month, year: year })
)

;; Check if user exceeded threshold
(define-read-only (exceeded-threshold
    (user principal)
    (month uint)
    (year uint)
    (threshold-gb uint)
  )
  (let
    (
      (usage-data (map-get? bandwidth-usage { user: user, month: month, year: year }))
    )
    (if (is-some usage-data)
      (let
        (
          (data (unwrap-panic usage-data))
          (total-usage (+ (get download-gb data) (get upload-gb data)))
        )
        (> total-usage threshold-gb)
      )
      false
    )
  )
)

;; Update admin
(define-public (set-admin (new-admin principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err u403))
    (var-set admin new-admin)
    (ok true)
  )
)
