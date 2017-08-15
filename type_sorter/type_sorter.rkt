#lang racket
(require htdp/dir)
(require json)
(require racket/path)	
(define root "/Users/celestehollenbeck/Research/js_files/") ; TODO: scriptify this and make 'root' not magical

(define directories (directory-list root))
(define browser-gui '())
(define node-js '())
(define node-js-GUI '())
(define unknowns '())

(define (get-folders dirs)
  (cond
    [(null? dirs)        '()]
    [(path-has-extension? (car dirs) #".json") (get-folders (cdr dirs))]
    [else                (cons
                          (car dirs)
                          (get-folders (cdr dirs)))]))

(define (sort-projects projects)
  (cond
    [(null? projects)        (void)]
    ; Projects are presumably probably likely nodeJS if they have a package.json file
    ; (although it must have a "name" and "version" defined).
    [(file-exists? (string-append root "/" (path->string (car projects)) "/package.json"))      (node-js-helper (car projects))]
    [(number? (string->number (path->string (car projects))))                 (begin
                                                                                (set! browser-gui (cons (car projects) browser-gui))
                                                                                (sort-projects (cdr projects)))]
    [else                             (begin
                                        (set! unknowns (cons (car projects) unknowns))
                                        (sort-projects (cdr projects)))]))

(define (node-js-helper file)
  (let ([current-file        (read-json (open-input-file (string-append root (path->string file) "/package.json")))])
    (cond
      [(hash-has-key? current-file 'dependencies)        (let ([dependencies        (hash-ref current-file 'dependencies)])
                                                           (cond
                                                             [(hash-has-key? dependencies 'jquery)     (set! node-js-GUI file)]
                                                             [else                                     (set! node-js (cons file node-js))]))]
      [else                  (set! node-js (cons file node-js))])))

(define (print-results list)
  (cond
    [(null? list)            (void)]
    [else                    (let ([current-file (read-json (open-input-file (string-append root (path->string (car list)) ".json")))])
                               (println (hash-ref current-file 'url))
                               (print-results (cdr list)))]))

(sort-projects (get-folders directories))
(print-results node-js)


