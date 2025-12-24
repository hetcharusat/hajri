import { Create, useForm } from "@refinedev/mantine";
import { TextInput, Textarea, Select } from "@mantine/core";
import { useSelect } from "@refinedev/mantine";

export const FacultyCreate = () => {
  const {
    getInputProps,
    saveButtonProps,
    refineCore: { formLoading },
  } = useForm({
    initialValues: {
      name: "",
      email: "",
      abbr: "",
      department_id: null,
    },
    refineCoreProps: {
      resource: "faculty",
      action: "create",
    },
  });

  const { selectProps: departmentSelectProps } = useSelect({
    resource: "departments",
    optionLabel: "name",
    optionValue: "id",
  });

  return (
    <Create isLoading={formLoading} saveButtonProps={saveButtonProps}>
      <TextInput
        mt="sm"
        label="Name"
        placeholder="Dr. John Smith"
        {...getInputProps("name")}
        required
      />
      <TextInput
        mt="sm"
        label="Email"
        placeholder="john.smith@university.edu"
        type="email"
        {...getInputProps("email")}
      />
      <TextInput
        mt="sm"
        label="Abbreviation"
        placeholder="JS"
        {...getInputProps("abbr")}
      />
      <Select
        mt="sm"
        label="Department"
        placeholder="Select department"
        {...getInputProps("department_id")}
        data={departmentSelectProps.data || []}
      />
    </Create>
  );
};
