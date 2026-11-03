import { useLocation, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { usePageVariants } from '../../lib/motion'
import React from 'react'

export function AnimatedOutlet() {
  const location = useLocation()
  const element = useOutlet()
  const variants = usePageVariants()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
        className="h-full w-full"
      >
        {element && React.cloneElement(element as React.ReactElement, { key: location.pathname })}
      </motion.div>
    </AnimatePresence>
  )
}