import { useReducedMotion } from 'framer-motion'

export const transition = {
  duration: 0.22,
  ease: [0.22, 0.8, 0.3, 1]
}

export const usePageVariants = () => {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 }
    }
  }

  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0, transition },
    exit: { opacity: 0, y: -8, transition }
  }
}