'use client';
import { useState } from 'react';
import {
  Button,
  Input,
  Textarea,
  Label,
  Checkbox,
  RadioGroup,
  RadioGroupItem,
  Switch,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Combobox,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Separator,
  Badge,
  Avatar,
  AvatarFallback,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  Skeleton,
  Spinner,
  Progress,
  Alert,
  AlertTitle,
  AlertDescription,
  Calendar,
  DatePicker,
} from '@ai-sales-agent/design-system';

export function ComponentsPreview() {
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [radioValue, setRadioValue] = useState('a');
  const [switchChecked, setSwitchChecked] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedCombo, setSelectedCombo] = useState('opt1');

  const comboOptions = [
    { value: 'opt1', label: 'Consulting Service / خدمة استشارية' },
    { value: 'opt2', label: 'Tech Support / الدعم الفني' },
    { value: 'opt3', label: 'Sales Inquiry / استفسار مبيعات' },
  ];

  return (
    <section aria-label="Core Component Primitives" className="tw:mt-8 tw:grid tw:gap-8">
      <div className="tw:border-b tw:border-border tw:pb-2">
        <h2 className="ds-text-section-title">DS-04 Core Component Matrix / مصفوفة المكونات الأساسية</h2>
        <p className="ds-text-helper">Authoritative test fixture for all Wave A-G primitives</p>
      </div>

      {/* Wave A: Inputs */}
      <div className="tw:grid tw:gap-4">
        <h3 className="ds-text-card-title">Wave A: Inputs & Controls</h3>
        <div className="tw:grid tw:gap-4 sm:tw:grid-cols-2 lg:tw:grid-cols-3">
          <div className="ds-stack">
            <Label htmlFor="preview-input" required>Standard Input / حقل إدخال</Label>
            <Input id="preview-input" placeholder="Enter business name..." />
          </div>

          <div className="ds-stack">
            <Label htmlFor="preview-input-invalid" error>Invalid Input / حقل به خطأ</Label>
            <Input id="preview-input-invalid" invalid defaultValue="Invalid value" />
          </div>

          <div className="ds-stack">
            <Label htmlFor="preview-textarea">Textarea / نص متعدد الأسطر</Label>
            <Textarea id="preview-textarea" placeholder="Enter notes..." />
          </div>
        </div>

        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-6 tw:pt-2">
          <div className="tw:flex tw:items-center tw:gap-2">
            <Checkbox
              id="preview-checkbox"
              checked={checkboxChecked}
              onCheckedChange={setCheckboxChecked}
            />
            <Label htmlFor="preview-checkbox">Checkbox / خيار تحديد</Label>
          </div>

          <div className="tw:flex tw:items-center tw:gap-2">
            <Switch
              id="preview-switch"
              checked={switchChecked}
              onCheckedChange={setSwitchChecked}
            />
            <Label htmlFor="preview-switch">Switch / مفتاح التبديل</Label>
          </div>

          <RadioGroup value={radioValue} onValueChange={setRadioValue} className="tw:flex tw:gap-4">
            <div className="tw:flex tw:items-center tw:gap-1.5">
              <RadioGroupItem value="a" id="r-a" />
              <Label htmlFor="r-a">Option A</Label>
            </div>
            <div className="tw:flex tw:items-center tw:gap-1.5">
              <RadioGroupItem value="b" id="r-b" />
              <Label htmlFor="r-b">Option B</Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      {/* Wave B: Selection */}
      <div className="tw:grid tw:gap-4">
        <h3 className="ds-text-card-title">Wave B: Selection (Select & Combobox)</h3>
        <div className="tw:grid tw:gap-4 sm:tw:grid-cols-2">
          <div className="ds-stack">
            <Label>Select Dropdown / القائمة المنسدلة</Label>
            <Select defaultValue="en">
              <SelectTrigger>
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English (US)</SelectItem>
                <SelectItem value="ar">العربية (Arabic)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="ds-stack">
            <Label>Searchable Combobox / مربع البحث والاختيار</Label>
            <Combobox
              options={comboOptions}
              value={selectedCombo}
              onValueChange={setSelectedCombo}
              placeholder="Choose service..."
            />
          </div>
        </div>
      </div>

      {/* Wave C: Surfaces */}
      <div className="tw:grid tw:gap-4">
        <h3 className="ds-text-card-title">Wave C: Surfaces, Badges & Avatars</h3>
        <div className="tw:grid tw:gap-4 sm:tw:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Restrained Card</CardTitle>
              <CardDescription>Calm surface token representation</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="ds-text-body-small">Clean borders, zero excessive shadows, predictable layout.</p>
            </CardContent>
            <CardFooter>
              <Button size="sm" variant="outline">Action</Button>
            </CardFooter>
          </Card>

          <div className="ds-stack tw:justify-center">
            <Label>Badges / الشارات</Label>
            <div className="tw:flex tw:flex-wrap tw:gap-2">
              <Badge variant="default">Primary</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="success">Active / نشط</Badge>
              <Badge variant="warning">Pending / قيد الانتظار</Badge>
              <Badge variant="destructive">Failed / فشل</Badge>
              <Badge variant="info">Info / معلومة</Badge>
            </div>
          </div>

          <div className="ds-stack tw:justify-center">
            <Label>Avatars / الصور الرمزية</Label>
            <div className="tw:flex tw:items-center tw:gap-3">
              <Avatar size="sm"><AvatarFallback>SA</AvatarFallback></Avatar>
              <Avatar size="default"><AvatarFallback>AI</AvatarFallback></Avatar>
              <Avatar size="lg"><AvatarFallback>AR</AvatarFallback></Avatar>
            </div>
          </div>
        </div>
      </div>

      {/* Wave D: Overlays */}
      <div className="tw:grid tw:gap-4">
        <h3 className="ds-text-card-title">Wave D: Overlays (Dialog, Sheet, Popover, Tooltip, Menu)</h3>
        <div className="tw:flex tw:flex-wrap tw:gap-3">
          <Dialog>
            <DialogTrigger className="ds-button tw:bg-transparent tw:border tw:border-border tw:text-foreground tw:rounded-md tw:px-4 tw:py-2 tw:text-sm">
              Open Dialog / حوار
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Standard Dialog</DialogTitle>
                <DialogDescription>Accessible modal dialog with focus restoration and backdrop.</DialogDescription>
              </DialogHeader>
              <div className="tw:py-4">
                <Input placeholder="Input inside dialog..." />
              </div>
              <DialogFooter>
                <DialogClose className="ds-button tw:bg-secondary tw:text-secondary-foreground tw:rounded-md tw:px-4 tw:py-2 tw:text-sm">
                  Cancel
                </DialogClose>
                <Button>Save changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger className="ds-button tw:bg-destructive tw:text-destructive-foreground tw:rounded-md tw:px-4 tw:py-2 tw:text-sm">
              Alert Dialog / تحذير
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone and will modify the records.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction>Confirm</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Sheet>
            <SheetTrigger className="ds-button tw:bg-transparent tw:border tw:border-border tw:text-foreground tw:rounded-md tw:px-4 tw:py-2 tw:text-sm">
              Open Sheet / لوحة جانبية
            </SheetTrigger>
            <SheetContent side="end">
              <SheetHeader>
                <SheetTitle>Side Drawer</SheetTitle>
                <SheetDescription>RTL-aware side panel sliding in from logical end.</SheetDescription>
              </SheetHeader>
              <div className="tw:py-6">
                <p className="ds-text-body-small">Content inside side sheet panel.</p>
              </div>
            </SheetContent>
          </Sheet>

          <Popover>
            <PopoverTrigger className="ds-button tw:bg-transparent tw:text-foreground tw:rounded-md tw:px-4 tw:py-2 tw:text-sm">
              Popover / نافذة منبثقة
            </PopoverTrigger>
            <PopoverContent>
              <h4 className="tw:font-medium tw:text-sm">Popover Title</h4>
              <p className="tw:text-xs tw:text-muted-foreground tw:mt-1">Lightweight non-modal popup surface.</p>
            </PopoverContent>
          </Popover>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="ds-button tw:bg-transparent tw:text-foreground tw:rounded-md tw:px-3 tw:py-1.5 tw:text-xs">
                Hover Tooltip
              </TooltipTrigger>
              <TooltipContent>
                <p>Tooltip informative text</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger className="ds-button tw:bg-transparent tw:border tw:border-border tw:text-foreground tw:rounded-md tw:px-4 tw:py-2 tw:text-sm">
              Dropdown Menu
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Profile / الملف الشخصي</DropdownMenuItem>
              <DropdownMenuItem>Settings / الإعدادات</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="tw:text-destructive">Log out / تسجيل الخروج</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Wave E: Navigation */}
      <div className="tw:grid tw:gap-4">
        <h3 className="ds-text-card-title">Wave E: Navigation (Tabs, Breadcrumb, Pagination)</h3>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Home / الرئيسية</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Settings / الإعدادات</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Design System</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Overview / نظرة عامة</TabsTrigger>
            <TabsTrigger value="tab2">Analytics / التحليلات</TabsTrigger>
            <TabsTrigger value="tab3">Audit / السجلات</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">
            <div className="ds-sample">Tab 1: Overview content panel</div>
          </TabsContent>
          <TabsContent value="tab2">
            <div className="ds-sample">Tab 2: Analytics content panel</div>
          </TabsContent>
          <TabsContent value="tab3">
            <div className="ds-sample">Tab 3: Audit content panel</div>
          </TabsContent>
        </Tabs>

        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink isActive>1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink>2</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>

      {/* Wave F: Feedback */}
      <div className="tw:grid tw:gap-4">
        <h3 className="ds-text-card-title">Wave F: Feedback (Alert, Progress, Spinner, Skeleton)</h3>
        <div className="tw:grid tw:gap-3">
          <Alert variant="info">
            <AlertTitle>System Notice / إشعار النظام</AlertTitle>
            <AlertDescription>All primitive components conform to strict token boundaries.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Action Required / إجراء مطلوب</AlertTitle>
            <AlertDescription>Review connection settings before proceeding.</AlertDescription>
          </Alert>
        </div>

        <div className="tw:flex tw:items-center tw:gap-6">
          <div className="tw:flex-1 ds-stack">
            <Label>Progress Bar (65%)</Label>
            <Progress value={65} />
          </div>
          <div className="tw:flex tw:items-center tw:gap-2">
            <Spinner size="default" />
            <span className="ds-text-helper">Processing...</span>
          </div>
          <div className="tw:w-32 ds-stack">
            <Label>Skeleton</Label>
            <Skeleton className="tw:h-8 tw:w-full" />
          </div>
        </div>
      </div>

      {/* Wave G: Date / Time */}
      <div className="tw:grid tw:gap-4">
        <h3 className="ds-text-card-title">Wave G: Calendar & DatePicker</h3>
        <div className="tw:flex tw:flex-wrap tw:gap-8 tw:items-start">
          <div className="ds-stack">
            <Label>Inline Calendar / التقويم</Label>
            <Calendar selected={selectedDate} onSelect={setSelectedDate} />
          </div>
          <div className="ds-stack tw:w-64">
            <Label>Date Picker Input</Label>
            <DatePicker date={selectedDate} onDateChange={setSelectedDate} />
          </div>
        </div>
      </div>
    </section>
  );
}
