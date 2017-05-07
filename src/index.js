const Rx = require('rxjs/Rx')
const gkm = require('gkm')
const exec = require('child_process').exec

const DEBOUNCE_TIME = 200

const touchPad = {disabled: 0, id: null}
const disable = acc => ({disabled: acc.disabled + 1, id: acc.id})
const enable = acc => ({disabled: 0, id: acc.id})

/* Selectors / functions */

const runBashCmd = cmd =>
  new Promise((res, req) =>
    exec(cmd, (err, stdout, stderr) =>
      (err || stderr) ? req(err) : res(stdout)
    )
  )

const setTouchPadStatus = (value, id) => runBashCmd(`xinput ${value} ${id}`)

const shouldEnableTouchPad = ({disabled, id}) => disabled === 0
  ? setTouchPadStatus('--enable', id)
  : null

const shouldDisableTouchPad = ({disabled, id}) => disabled === 1
  ? setTouchPadStatus('--disable', id)
  : null

/* Streams */

const keyPresses = Rx.Observable.create(observer =>
    gkm.events.on('key.pressed', () => observer.next())
  )

const keyPressesDisable$ =
  keyPresses
    .mapTo(disable)

const keyPressesEnable$ =
  keyPresses
    .debounce(() => Rx.Observable.timer(DEBOUNCE_TIME))
    .mapTo(enable)

const handleKeyPresses$ =
  Rx.Observable.merge(keyPressesEnable$, keyPressesDisable$)
    .startWith(touchPad)
    .scan((acc, curr) => curr(acc))

/* Start of program */
runBashCmd(`
  xinput | grep Touchpad | grep -o 'id=[0-9][0-9]' | grep -o '[0-9][0-9]'
`)
.then(id => {
  touchPad.id = id

  handleKeyPresses$
    .subscribe(val => shouldDisableTouchPad(val) || shouldEnableTouchPad(val))
})
.catch(err => process.exit())
