import {
    Upload, Check, Loader2, Award, BookOpen, MessageCircle,
    RefreshCw, ChevronRight, Eye, EyeOff, Printer, Maximize2,
    X, GraduationCap, Key, Download, LucideIcon,
    BarChart, PieChart, TrendingUp, Users, MapPin, Calendar,
    Building, Calculator, LineChart, Link, Search, PenTool, FileX, ChevronDown, MonitorPlay
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mapping
// Note: We need to cast the keys to string to allow indexing if we want strict typing,
// but for this simple map we can just define the object.
const iconMap: Record<string, LucideIcon> = {
    Upload, Check, Loader2, Award, BookOpen, MessageCircle,
    RefreshCw, ChevronRight, Eye, EyeOff, Printer, Maximize2,
    X, GraduationCap, Key, Download,
    BarChart, PieChart, TrendingUp, Users, MapPin, Calendar,
    Building, Calculator, LineChart, Link, Search, PenTool, FileX, ChevronDown, MonitorPlay
};

export type IconName = keyof typeof iconMap;

interface IconProps {
    name: string; // Allow string to support dynamic names from legacy data, though strict typing is better
    size?: number;
    className?: string;
}

export const Icon = ({ name, size = 24, className }: IconProps) => {
    const IconComponent = iconMap[name as IconName];
    if (!IconComponent) {
        console.warn(`Icon "${name}" not found`);
        return null;
    }
    return <IconComponent size={size} className={cn(className)} />;
};
