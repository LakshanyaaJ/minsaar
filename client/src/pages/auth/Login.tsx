import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useAuthStore } from '../../store/auth'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function Login() {
  const login = useAuthStore(state => state.login)
  const navigate = useNavigate()
  
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  })

  const onSubmit = (data: LoginForm) => {
    login(data.email)
    navigate('/app/overview')
  }

  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="font-semibold text-2xl text-ink flex items-center gap-1">
            Minsaar<span className="w-2 h-2 rounded-full bg-accent mb-2"></span>
          </div>
        </div>
        
        <Card>
          <h1 className="text-xl font-semibold text-ink mb-1">Sign in</h1>
          <p className="text-sm text-ink-2 mb-6">Enter any email and password for the demo.</p>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Email</label>
              <Input type="email" placeholder="admin@campus.edu" {...register('email')} />
              {errors.email && <p className="text-xs text-rose mt-1">{errors.email.message}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Password</label>
              <Input type="password" placeholder="••••••••" {...register('password')} />
              {errors.password && <p className="text-xs text-rose mt-1">{errors.password.message}</p>}
            </div>
            
            <Button type="submit" className="w-full mt-2">Sign in</Button>
          </form>
        </Card>
      </div>
    </div>
  )
}